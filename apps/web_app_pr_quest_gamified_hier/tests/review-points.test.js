import test from 'node:test';
import assert from 'node:assert/strict';
import { pulseReview, recordApproval, pointsSnapshot, createReviewPointsStore } from '../server/reviewPoints.js';
const makeFiles = () => ['one.js', 'two.js', 'three.js'].map((path, id) => ({ id: String(id), path, diffChunks: [{ lines: [{ content: path }] }], reviewerStatuses: {} }));
function scenario() {
  const files = makeFiles();
  let state = {};
  return { files, get state() { return state; },
    pulse(user, file, time) { state = pulseReview(files, state, user, file, time); },
    approve(user, file, time, bulk = false) {
      files.find(f => f.id === file).reviewerStatuses[user] = { status: 'approved' };
      state = recordApproval(files, state, user, file, { now: time, bulk });
      return pointsSnapshot(files, state, user);
    },
    read(user, file, start, duration) { for (let t = start; t <= start + duration; t += 1000) this.pulse(user, file, t); },
    snapshot(user) { return pointsSnapshot(files, state, user); }
  };
}
test('fast approvals decay proportionally and full points cap at thirty seconds', () => {
  for (const [seconds, expected] of [[0,1],[3,1],[15,5],[30,10],[45,10]]) {
    const s = scenario(); s.read('alice','0',0,seconds*1000);
    assert.equal(s.approve('alice','0',seconds*1000).myPoints,expected);
  }
});
test('one block cannot bank time for rapid approvals of every block', () => {
  const s = scenario(); s.read('alice','0',0,30000);
  assert.equal(s.approve('alice','0',30000).teamPoints,10);
  assert.equal(s.approve('alice','1',30001).teamPoints,11);
  s.pulse('alice','2',31000);
  assert.equal(s.approve('alice','2',32000).teamPoints,12);
});
test('parallel reviewers of distinct blocks earn a shared bonus exactly once', () => {
  const s = scenario();
  s.read('alice','0',0,30000); s.read('bob','1',0,30000);
  s.approve('alice','0',30000);
  assert.deepEqual(s.approve('bob','1',31000),{teamPoints:30,myPoints:10,bonusPoints:10});
  assert.equal(s.approve('bob','1',32000).teamPoints,30);
  s.read('carol','2',0,30000);
  assert.equal(s.approve('carol','2',33000).teamPoints,40);
});
test('sequential work, same blocks, fast reviews, and late approvals do not earn parallel bonuses', () => {
  for (const variant of ['sequential','same-block','fast','late']) {
    const s = scenario(); s.read('alice','0',0,30000); s.approve('alice','0',30000);
    const file = variant === 'same-block' ? '0' : '1';
    const start = variant === 'sequential' ? 31000 : 0;
    s.read('bob',file,start,variant === 'fast' ? 3000 : 30000);
    const end = variant === 'late' ? 100000 : start + (variant === 'fast' ? 3000 : 30000);
    assert.equal(s.approve('bob',file,end).bonusPoints,0,variant);
  }
});
test('paused views and missing heartbeat gaps do not accrue idle credit', () => {
  const s = scenario(); s.read('alice','0',0,10000); s.pulse('alice',null,11000);
  s.pulse('alice','0',90000);
  assert.equal(s.approve('alice','0',90000).myPoints,3);
  const gap = scenario(); gap.pulse('alice','0',0); gap.pulse('alice','0',60000);
  assert.equal(gap.approve('alice','0',60000).myPoints,1);
});
test('bulk approvals get zero, and undo/reapprove restores rather than farms points', () => {
  const s = scenario(); s.read('alice','0',0,30000);
  assert.equal(s.approve('alice','0',30000,true).myPoints,0);
  const normal = scenario(); normal.read('alice','0',0,15000); normal.approve('alice','0',15000);
  normal.files[0].reviewerStatuses.alice.status='pending';
  assert.equal(normal.snapshot('alice').myPoints,0);
  normal.read('alice','0',16000,30000);
  assert.equal(normal.approve('alice','0',46000).myPoints,5);
});
test('changed code and revoked approvals invalidate dependent bonuses', () => {
  const s = scenario(); s.read('alice','0',0,30000);s.read('bob','1',0,30000);
  s.approve('alice','0',30000);s.approve('bob','1',31000);
  s.files[0].reviewerStatuses.alice.status='flagged';
  assert.equal(s.snapshot('bob').teamPoints,10);
  s.files[1].diffChunks=[];
  assert.equal(s.snapshot('bob').teamPoints,0);
});
test('server store survives reloads and isolates PR scores', () => {
  const settings = new Map();
  const db = { getSetting: key=>settings.get(key),setSetting:(key,value)=>{settings.set(key,value);return true;} };
  const s=scenario();s.read('alice','0',0,30000);s.approve('alice','0',30000);
  createReviewPointsStore(db).save('PR-1',s.state);
  const reloaded=createReviewPointsStore(db);
  assert.equal(pointsSnapshot(s.files,reloaded.read('PR-1'),'alice').myPoints,10);
  assert.equal(pointsSnapshot(s.files,reloaded.read('PR-2'),'alice').myPoints,0);
});

test('switching reviewers gives each a separate minimum award on the same block', () => {
  const s = scenario();
  assert.equal(s.approve('reviewer_1','0',1000).teamPoints,1);
  const second = s.approve('reviewer_2','0',1330);
  assert.deepEqual(second,{teamPoints:2,myPoints:1,bonusPoints:0});
  assert.equal(s.approve('reviewer_2','0',4000).teamPoints,2);
});
test('legacy zero awards with recorded manual time gain minimum credit without crediting bulk', () => {
  const s = scenario();s.read('alice','0',0,1000);s.approve('alice','0',1000);
  const stored = structuredClone(s.state);
  const manual = Object.values(stored.awards)[0];
  manual.points=0;delete manual.bulk;
  assert.equal(pointsSnapshot(s.files,stored,'alice').myPoints,1);
  manual.activeMs=0;
  assert.equal(pointsSnapshot(s.files,stored,'alice').myPoints,0);
});

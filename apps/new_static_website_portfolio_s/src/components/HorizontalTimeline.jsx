import React, { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Search, ArrowRightLeft } from 'lucide-react';
import TimelineCard from './TimelineCard.jsx';

export default function HorizontalTimeline({
  items,
  activeFilter,
  setFilter,
  searchQuery,
  setSearchQuery,
  sectionRef
}) {
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const filteredItems = items.filter(item => {
    const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tech.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const updateProgress = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      const maxScroll = scrollWidth - clientWidth;
      const pct = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, pct)));
    }
  };

  const handleWheel = (e) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

    if (delta > 0 && el.scrollLeft < maxScroll - 1) {
      e.preventDefault();
      el.scrollLeft += delta * 1.1;
      updateProgress();
    } else if (delta < 0 && el.scrollLeft > 0) {
      e.preventDefault();
      el.scrollLeft += delta * 1.1;
      updateProgress();
    }
  };

  const handleMouseDown = (e) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeftState(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    scrollContainerRef.current.scrollLeft = scrollLeftState - walk;
    updateProgress();
  };

  const scrollByAmount = (amount) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(updateProgress, 350);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, []);

  return (
    <section ref={sectionRef} className="py-10 bg-slate-100/50 dark:bg-slate-900/60 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Interactive Horizontal Timeline</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Career & Project Timeline
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1 sm:hidden">
              {[
                { id: 'all', label: 'All' },
                { id: 'project', label: 'Projects' },
                { id: 'experience', label: 'Experience' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeFilter === id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title or stack..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => scrollByAmount(-380)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                title="Scroll Left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollByAmount(380)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                title="Scroll Right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-150 ease-out"
            style={{ width: `${Math.max(8, scrollProgress)}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium mt-1">
          <span>Scroll using mouse wheel, touchpad swipe, or click & drag</span>
          <span>{filteredItems.length} items listed</span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onScroll={updateProgress}
        className="timeline-scrollbar overflow-x-auto py-8 px-4 sm:px-8 cursor-grab active:cursor-grabbing select-none scroll-smooth flex space-x-6 min-h-[420px] transition-all"
      >
        {filteredItems.length > 0 ? (
          filteredItems.map((item, index) => (
            <TimelineCard key={item.id} item={item} index={index} />
          ))
        ) : (
          <div className="w-full flex flex-col items-center justify-center py-16 text-center text-slate-400 bg-white dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 mx-4">
            <SlidersHorizontal className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No items found matching filter</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or switching categories.</p>
          </div>
        )}
      </div>
    </section>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_DATA } from './data/portfolioData.js';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import HorizontalTimeline from './components/HorizontalTimeline.jsx';
import SkillsSection from './components/SkillsSection.jsx';
import AddItemModal from './components/AddItemModal.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('portfolio_theme') || 'light';
  });
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('portfolio_timeline_items');
    return saved ? JSON.parse(saved) : INITIAL_DATA.items;
  });
  const [activeFilter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('portfolio_timeline_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('portfolio_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleAddItem = (newItem) => {
    setItems(prev => [newItem, ...prev]);
  };

  const handleResetData = () => {
    if (window.confirm('Reset portfolio timeline to original defaults?')) {
      setItems(INITIAL_DATA.items);
      localStorage.removeItem('portfolio_timeline_items');
    }
  };

  const scrollToTimeline = () => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 ${theme}`}>
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenModal={() => setIsModalOpen(true)}
        activeFilter={activeFilter}
        setFilter={setFilter}
        profile={INITIAL_DATA.profile}
      />

      <main>
        <Hero profile={INITIAL_DATA.profile} scrollToTimeline={scrollToTimeline} />
        <HorizontalTimeline
          items={items}
          activeFilter={activeFilter}
          setFilter={setFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sectionRef={sectionRef}
        />
        <SkillsSection skills={INITIAL_DATA.skills} />
      </main>

      <Footer profile={INITIAL_DATA.profile} onResetData={handleResetData} />

      <AddItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddItem}
      />
    </div>
  );
}
"use client"

import { useStore, getLocalDateString } from "@/lib/store";
import { translations } from "@/lib/translations";
import { Reveal } from "@/components/ui/reveal";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import { NoteEditor } from "@/components/notes/note-editor";
import { Note } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { GoalCard } from "@/components/dashboard/goal-card";
import { Coins, AlertTriangle, X } from "lucide-react";

const QuoteSection = dynamic(() => import("@/components/dashboard/quote-section").then(mod => mod.QuoteSection), { ssr: false, loading: () => <div className="h-20 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });
const PulseChart = dynamic(() => import("@/components/dashboard/pulse-chart").then(mod => mod.PulseChart), { ssr: false, loading: () => <div className="h-48 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });
const StatsCards = dynamic(() => import("@/components/dashboard/stats-cards").then(mod => mod.StatsCards), { ssr: false, loading: () => <div className="h-24 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });
const ProjectList = dynamic(() => import("@/components/dashboard/project-list").then(mod => mod.ProjectList), { ssr: false, loading: () => <div className="h-32 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });
const DailyFocusWidget = dynamic(() => import("@/components/dashboard/daily-focus").then(mod => mod.DailyFocusWidget), { ssr: false, loading: () => <div className="h-40 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });
const EnhancedTaskList = dynamic(() => import("@/components/dashboard/enhanced-task-list").then(mod => mod.EnhancedTaskList), { ssr: false, loading: () => <div className="h-48 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });
const WeeklyProgressChart = dynamic(() => import("@/components/dashboard/weekly-progress-chart").then(mod => mod.WeeklyProgressChart), { ssr: false, loading: () => <div className="h-40 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });
const DashboardWidgets = dynamic(() => import("@/components/dashboard/dashboard-widgets").then(mod => mod.DashboardWidgets), { ssr: false, loading: () => <div className="h-36 animate-pulse bg-zinc-300/10 dark:bg-zinc-800/10 rounded-3xl" /> });

export default function Home() {
  const language = useStore(state => state.language);
  const addNote = useStore(state => state.addNote);
  const tasks = useStore(state => state.tasks);
  const goals = useStore(state => state.goals || []);
  const showToast = useStore(state => state.showToast);
  const transactions = useStore(state => state.transactions ?? []);
  const balance = useMemo(() => {
    return transactions.reduce((sum, t) => {
      const amt = Number(t.amount) || 0;
      return sum + (t.type === 'expense' ? -amt : amt);
    }, 0);
  }, [transactions]);

  const activeConservationGoal = useMemo(() => {
    const todayStr = getLocalDateString();
    const active = (transactions || []).filter(tx =>
      tx.type === 'income' &&
      tx.conservationGoalDate &&
      tx.date <= todayStr &&
      todayStr <= tx.conservationGoalDate
    );
    if (active.length === 0) return null;
    return active.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [transactions]);

  const timelineData = useMemo(() => {
    if (!activeConservationGoal) return null;
    const dates: { dateStr: string; dayNum: number; isCompleted: boolean; isLast: boolean }[] = [];
    try {
      const start = new Date(activeConservationGoal.date + 'T00:00:00');
      const end = new Date(activeConservationGoal.conservationGoalDate + 'T00:00:00');
      const todayVal = new Date(getLocalDateString() + 'T00:00:00');

      let curr = new Date(start);
      while (curr <= end) {
        dates.push({
          dateStr: curr.toISOString().split('T')[0],
          dayNum: curr.getDate(),
          isCompleted: curr <= todayVal,
          isLast: curr.getTime() === end.getTime()
        });
        curr.setDate(curr.getDate() + 1);
      }
    } catch (e) {
      console.error(e);
    }

    const totalDays = dates.length;
    const completedDays = dates.filter(d => d.isCompleted).length;
    const completedPercentage = totalDays > 1 ? ((completedDays - 1) / (totalDays - 1)) * 100 : 0;

    return {
      dates,
      totalDays,
      completedDays,
      completedPercentage
    };
  }, [activeConservationGoal]);
  const pinnedGoal = useMemo(() => (goals || []).find(g => g.pinned), [goals]);
  const t = (translations[language]?.dashboard || translations['en'].dashboard) as any;
  const noteTranslations = (translations[language]?.pages?.notes || translations['en'].pages.notes) as any;
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showWeeklyTooltip, setShowWeeklyTooltip] = useState(false);
  const [showConservationAlert, setShowConservationAlert] = useState(true);
  const tourStep = useStore(state => state.tourStep);

  useEffect(() => {
    if (!isMounted) return;
    const isTourCompleted = localStorage.getItem('mynotes_tour_completed') === 'true';
    const isShown = localStorage.getItem('mynotes_weekly_breakdown_shown') === 'true';

    let hideTimer: NodeJS.Timeout;
    let showTimer: NodeJS.Timeout;

    if (isTourCompleted && !isShown) {
      showTimer = setTimeout(() => {
        setShowWeeklyTooltip(true);
        hideTimer = setTimeout(() => {
          setShowWeeklyTooltip(false);
          localStorage.setItem('mynotes_weekly_breakdown_shown', 'true');
        }, 5000);
      }, 2500);
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [tourStep, isMounted]);

  const today = useMemo(() => getLocalDateString(), []);

  // Use Memo for performance optimization and to prevent infinite loops
  const { todaysTasks, percentage } = useMemo(() => {
    const todayDate = new Date();
    const currentDay = todayDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    const todays = tasks.filter(task => {
      if (task.recurrence === 'None') return !task.completed || (task.completed && (task.completedDates?.includes(today) ?? false));
      return true;
    });

    const completed = todays.filter(task => {
      if (task.recurrence !== 'None') {
        const isCompleted = task.completedDates?.includes(today) ?? false;
        const isActive = task.recurrence === 'Once' || !task.activeDays || task.activeDays.includes(currentDay);
        return isCompleted || !isActive;
      }
      return task.completed;
    }).length;

    const total = todays.length || 1;
    return {
      todaysTasks: todays,
      percentage: Math.round((completed / total) * 100)
    };
  }, [tasks, today]);
  useEffect(() => {
    setIsMounted(true);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Run only on mount

  const handleNewNote = () => {
    const newNote = addNote({
      title: noteTranslations.untitled,
      blocks: [{ id: '1', type: 'text', content: '' }],
      tags: []
    });
    setEditingNote(newNote);
    showToast(language === 'es' ? "Nota creada" : "Note created", "success");
  };

  const strokeDashoffset = 175.9 - (percentage / 100) * 175.9;

  const showMobile = !isMounted || isMobile;
  const showDesktop = !isMounted || !isMobile;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 font-[family-name:var(--font-geist-sans)] relative selection:bg-primary/30">
      {/* Ambient Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 transform-gpu" style={{ willChange: "transform" }}>
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] dark:bg-purple-900/20 transform-gpu" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] dark:bg-blue-900/20 transform-gpu" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col gap-4 pb-24 text-center sm:text-left pt-0">

        {/* MOBILE ONLY LAYOUT (as per user sketch) */}
        {showMobile && (
          <div className="flex md:hidden flex-col gap-4 mt-2">

          {/* 1. Quote */}
          <Reveal delay={0.1} margin="0px">
            <QuoteSection />
          </Reveal>

          {/* 2. Week (Weekly Progress) */}
          <Reveal delay={0.2} margin="0px" className={`relative transition-all duration-300 ${showWeeklyTooltip ? 'z-50' : 'z-10'}`}>
            <div className="relative z-30">
              <span className="absolute -top-2 -left-1 text-[10px] font-black uppercase text-primary/40 tracking-widest z-20">{t.week}</span>
              <WeeklyProgressChart />
              <AnimatePresence>
                {showWeeklyTooltip && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute z-[100] left-4 right-4 mt-2 p-5 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col text-center"
                  >
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed">
                      {language === 'es' ? (
                        <>
                          <strong>El desglose semanal</strong> te demostrara tu rendimiento a lo largo de los dias, y lo comparar con la <strong>semana pasada</strong>
                        </>
                      ) : (
                        <>
                          <strong>The weekly breakdown</strong> will show your performance over the days and compare it to <strong>last week</strong>
                        </>
                      )}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>

          {/* Active Conservation Goal Timeline */}
          {activeConservationGoal && timelineData && (
            <Reveal delay={0.25} margin="0px">
              <div className="glass-panel p-3.5 sm:p-4 rounded-2xl relative overflow-hidden w-full flex flex-col gap-2.5 border border-purple-500/20 dark:border-purple-500/30 shadow-md shadow-purple-500/5 dark:shadow-purple-500/10 text-left">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      {language === 'es' ? "Meta de Conservación de Capital" : "Capital Conservation Goal"}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      {language === 'es'
                        ? `Conserva tu saldo inicial de $${Number(activeConservationGoal.conservationStartBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} hasta el ${activeConservationGoal.conservationGoalDate}`
                        : `Conserve your starting balance of $${Number(activeConservationGoal.conservationStartBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} until ${activeConservationGoal.conservationGoalDate}`}
                    </p>
                  </div>
                  <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-xl shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>

                {/* Timeline Bar (Narrow Y axis) */}
                <div className="relative flex items-center justify-between w-full py-1 mt-1 select-none">
                  {/* Cylinder Gradient Track */}
                  <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-2 bg-gradient-to-r from-sky-400 via-indigo-500 via-purple-600 to-pink-500 rounded-full z-0" />

                  {/* Completed celeste overlay track */}
                  <div
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-2 bg-[#00f0ff] rounded-l-full z-10 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,240,255,0.5)]"
                    style={{ width: `calc(${timelineData.completedPercentage}% - 4px)` }}
                  />

                  {/* Nodes container */}
                  <div className="flex items-center justify-between w-full relative z-20 gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5">
                    {timelineData.dates.map((d) => {
                      const isLast = d.isLast;
                      const isCompleted = d.isCompleted;

                      if (isLast) {
                        return (
                          <div
                            key={d.dateStr}
                            className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-400 font-extrabold text-xs z-20 flex items-center justify-center border-2 border-[#7030a0] shadow-md shrink-0"
                            title={d.dateStr}
                          >
                            {d.dayNum}
                          </div>
                        );
                      } else if (isCompleted) {
                        return (
                          <div
                            key={d.dateStr}
                            className="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border-2 border-sky-400 text-sky-500 font-black text-[10px] z-20 flex items-center justify-center shadow-sm shrink-0"
                            title={d.dateStr}
                          >
                            {d.dayNum}
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={d.dateStr}
                            className="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border-2 border-[#7030a0] text-purple-700 dark:text-purple-400 font-black text-[10px] z-20 flex items-center justify-center shadow-xs shrink-0"
                            title={d.dateStr}
                          >
                            {d.dayNum}
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>

                {/* Balance check alert */}
                {showConservationAlert && balance < (activeConservationGoal.conservationStartBalance ?? 0) && (
                  <div className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center justify-between gap-1.5 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 w-full mt-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{language === 'es' ? "Alerta: Tu saldo bajó de la meta de conservación!" : "Warning: Your balance is below the conservation goal!"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConservationAlert(false)}
                      className="text-rose-500 hover:text-rose-750 p-1 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0"
                      title={language === 'es' ? "Quitar" : "Dismiss"}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Reveal>
          )}

          {/* 3. Row: Task % and New Note */}
          <div className="grid grid-cols-2 gap-4">
            <Reveal delay={0.3} margin="0px" className="w-full">
              <div className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center gap-0 h-32 w-full">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-secondary/30" />
                    <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="201" strokeDashoffset={201 - (percentage / 100) * 201} className="text-primary neon-glow" strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-xl font-bold">{percentage}%</span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.4} margin="0px" className="w-full">
              <button
                onClick={handleNewNote}
                className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center gap-2 h-32 w-full hover:bg-primary/5 transition-all text-center group active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm font-bold tracking-wide">{t.newNote}</span>
              </button>
            </Reveal>
          </div>

          {/* Pinned Goal (Mobile) */}
          {pinnedGoal && (
            <Reveal delay={0.42} margin="0px">
              <section className="w-full mt-2">
                <span className="text-[10px] font-black uppercase text-primary/40 tracking-widest block mb-1.5 px-0.5 text-left">
                  {language === 'es' ? "Meta Fijada" : "Pinned Goal"}
                </span>
                <GoalCard goal={pinnedGoal} />
              </section>
            </Reveal>
          )}

          {/* 4. Enfoque de hoy y tareas completadas */}
          <Reveal delay={0.45} margin="0px">
            <section className="w-full mt-2">
              <div className="flex justify-between items-center mb-1.5 px-0.5">
                <span className="text-[10px] font-black uppercase text-primary/40 tracking-widest">{t.todaysFocus}</span>
                <div className="flex gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                  <span>{t.recurrenceEnabled}</span>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar glass-panel p-2 rounded-xl">
                <EnhancedTaskList />
              </div>
            </section>
          </Reveal>

          {/* 5. Productivity Pulse & Projects */}
          <Reveal delay={0.5} margin="0px">
            <section className="w-full mt-2">
              <h2 className="sr-only">{t.charts.productivityPulse}</h2>
              <PulseChart />
            </section>
          </Reveal>

          <Reveal delay={0.6} margin="0px">
            <section className="w-full mt-2">
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="text-sm font-semibold tracking-tight uppercase">{translations[language].nav.projects}</h2>
                <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider">{t.seeAll}</button>
              </div>
              <ProjectList />
            </section>
          </Reveal>

          {/* 6. Dashboard Widgets (Pinned Note & Calendar) */}
          <Reveal delay={0.7} margin="0px">
            <section className="w-full mt-2">
              <DashboardWidgets onOpenNote={setEditingNote} />
            </section>
          </Reveal>
        </div>
      )}

        {/* DESKTOP LAYOUT (unchanged) */}
        {showDesktop && (
          <div className="hidden md:flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <Reveal delay={0.2} margin="0px">
              <QuoteSection />
            </Reveal>

            <Reveal delay={0.3} margin="0px" className={`relative transition-all duration-300 ${showWeeklyTooltip ? 'z-50' : 'z-10'}`}>
              <div className="relative z-30">
                <WeeklyProgressChart />
                <AnimatePresence>
                  {showWeeklyTooltip && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute z-[100] left-4 right-4 mt-2 p-5 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col text-center"
                    >
                      <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed">
                        {language === 'es' ? (
                          <>
                            <strong>El desglose semanal</strong> te demostrara tu rendimiento a lo largo de los dias, y lo comparar con la <strong>semana pasada</strong>
                          </>
                        ) : (
                          <>
                            <strong>The weekly breakdown</strong> will show your performance over the days and compare it to <strong>last week</strong>
                          </>
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>

            {/* Desktop Active Conservation Goal Timeline */}
            {activeConservationGoal && timelineData && (
              <Reveal delay={0.35} margin="0px">
                <div className="glass-panel p-3.5 sm:p-4 rounded-2xl relative overflow-hidden w-full flex flex-col gap-2.5 border border-purple-500/20 dark:border-purple-500/30 shadow-md shadow-purple-500/5 dark:shadow-purple-500/10 text-left">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        {language === 'es' ? "Meta de Conservación de Capital" : "Capital Conservation Goal"}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        {language === 'es'
                          ? `Conserva tu saldo inicial de $${Number(activeConservationGoal.conservationStartBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} hasta el ${activeConservationGoal.conservationGoalDate}`
                          : `Conserve your starting balance of $${Number(activeConservationGoal.conservationStartBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} until ${activeConservationGoal.conservationGoalDate}`}
                      </p>
                    </div>
                    <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-xl shrink-0">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Timeline Bar (Narrow Y axis) */}
                  <div className="relative flex items-center justify-between w-full py-1 mt-1 select-none">
                    {/* Cylinder Gradient Track */}
                    <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-2 bg-gradient-to-r from-sky-400 via-indigo-500 via-purple-600 to-pink-500 rounded-full z-0" />

                    {/* Completed celeste overlay track */}
                    <div
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-2 bg-[#00f0ff] rounded-l-full z-10 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,240,255,0.5)]"
                      style={{ width: `calc(${timelineData.completedPercentage}% - 4px)` }}
                    />

                    {/* Nodes container */}
                    <div className="flex items-center justify-between w-full relative z-20 gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5">
                      {timelineData.dates.map((d) => {
                        const isLast = d.isLast;
                        const isCompleted = d.isCompleted;

                        if (isLast) {
                          return (
                            <div
                              key={d.dateStr}
                              className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-400 font-extrabold text-xs z-20 flex items-center justify-center border-2 border-[#7030a0] shadow-md shrink-0"
                              title={d.dateStr}
                            >
                              {d.dayNum}
                            </div>
                          );
                        } else if (isCompleted) {
                          return (
                            <div
                              key={d.dateStr}
                              className="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border-2 border-sky-400 text-sky-500 font-black text-[10px] z-20 flex items-center justify-center shadow-sm shrink-0"
                              title={d.dateStr}
                            >
                              {d.dayNum}
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={d.dateStr}
                              className="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border-2 border-[#7030a0] text-purple-700 dark:text-purple-400 font-black text-[10px] z-20 flex items-center justify-center shadow-xs shrink-0"
                              title={d.dateStr}
                            >
                              {d.dayNum}
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>

                  {/* Balance check alert */}
                  {showConservationAlert && balance < (activeConservationGoal.conservationStartBalance ?? 0) && (
                    <div className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center justify-between gap-1.5 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 w-full mt-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{language === 'es' ? "Alerta: Tu saldo bajó de la meta de conservación!" : "Warning: Your current balance is below the conservation goal starting balance!"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowConservationAlert(false)}
                        className="text-rose-500 hover:text-rose-750 p-1 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0"
                        title={language === 'es' ? "Quitar" : "Dismiss"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Reveal>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            <Reveal delay={0.4} margin="0px">
              <DailyFocusWidget />
            </Reveal>
            <Reveal delay={0.6} margin="0px">
              <section className="w-full">
                <div className="flex justify-between items-center mb-1.5 px-0.5">
                  <h2 className="text-base font-bold tracking-tight">{t.todaysFocus}</h2>
                  <div className="flex gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    <span>{t.recurrenceEnabled}</span>
                  </div>
                </div>
                <div className="max-h-[176px] overflow-y-auto pr-2 custom-scrollbar">
                  <EnhancedTaskList />
                </div>
              </section>
            </Reveal>
          </div>

          {/* Pinned Goal (Desktop) */}
          {pinnedGoal && (
            <Reveal delay={0.48} margin="0px">
              <section className="w-full mt-2">
                <span className="text-sm font-bold tracking-tight uppercase block mb-3 px-1 text-left">
                  {language === 'es' ? "Meta Fijada" : "Pinned Goal"}
                </span>
                <GoalCard goal={pinnedGoal} />
              </section>
            </Reveal>
          )}

          <Reveal delay={0.5} margin="0px">
            <section className="w-full">
              <h2 className="sr-only">{t.charts.productivityPulse}</h2>
              <PulseChart />
            </section>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Reveal delay={0.7} margin="0px">
              <section className="w-full">
                <div className="flex justify-between items-center mb-4 px-1">
                  <h2 className="text-lg font-semibold tracking-tight">{translations[language].nav.projects}</h2>
                  <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider">{t.seeAll}</button>
                </div>
                <ProjectList />
              </section>
            </Reveal>

            <Reveal delay={0.8} margin="0px">
              <section className="w-full">
                <h2 className="sr-only">Stats Overview</h2>
                <StatsCards />
              </section>
            </Reveal>
          </div>

          <Reveal delay={0.9} margin="0px">
            <section className="w-full">
              <DashboardWidgets onOpenNote={setEditingNote} />
            </section>
          </Reveal>
        </div>
      )}
      </div>

      {editingNote && (
        <NoteEditor
          note={editingNote}
          onClose={() => setEditingNote(null)}
        />
      )}
    </div>
  );
}

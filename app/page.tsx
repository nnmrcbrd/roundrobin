"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2, Settings, ListOrdered, Zap } from 'lucide-react';

const THEME = {
  OatMilk: '#F2E0D2',
  RoseQuartz: '#F9CBD6',
  Blush: '#F2AFBC',
  RedWine: '#9E182B',
};

type Process = {
  id: string;
  arrivalTime: number | string; 
  burstTime: number | string;
  remainingTime: number;
  color: string;
  finishTime?: number;
  waitingTime?: number;
  turnaroundTime?: number;
};

type TimeSlice = {
  processId: string | null;
  startTime: number;
  endTime: number;
};

type QueueSnapshot = {
  time: number;
  queue: string[]; 
  event: string; 
};

const COLORS = [
  'bg-pink-400', 'bg-purple-400', 'bg-rose-400', 'bg-fuchsia-400', 
  'bg-violet-400', 'bg-indigo-400', 'bg-red-400', 'bg-orange-300'
];
const WIDTH_SCALE = 40;

const runSimulation = (inputProcesses: Process[], quantum: number | string) => {
  let processes = inputProcesses.map(p => ({ 
    ...p, 
    arrivalTime: p.arrivalTime === '' ? 0 : Number(p.arrivalTime),
    burstTime: p.burstTime === '' ? 0 : Number(p.burstTime),
    remainingTime: p.burstTime === '' ? 0 : Number(p.burstTime) 
  })).filter(p => p.burstTime > 0); 

  let timeline: TimeSlice[] = [];
  let complete: Process[] = [];
  let queueHistory: QueueSnapshot[] = [];
  
  const currentQuantum = (typeof quantum === 'number' && quantum > 0) ? quantum : 1; 
  
  let readyQ: number[] = [];
  let activeP = [...processes];
  let t = 0;
  let completedCount = 0;
  
  activeP.forEach((p, idx) => {
      if (p.arrivalTime <= 0) readyQ.push(idx);
  });

  queueHistory.push({
      time: t,
      queue: readyQ.map(idx => activeP[idx].id),
      event: "Simulation Start / Initial Arrivals"
  });

  while (completedCount < activeP.length) {
      
      if (readyQ.length === 0) {
          let nextArrival = Infinity;
          activeP.forEach(p => {
              if (p.remainingTime > 0 && Number(p.arrivalTime) > t && Number(p.arrivalTime) < nextArrival) {
                  nextArrival = Number(p.arrivalTime);
              }
          });

          if (nextArrival === Infinity) break; 

          timeline.push({ processId: null, startTime: t, endTime: nextArrival });
          t = nextArrival;

          const priorQueueLength = readyQ.length;
          activeP.forEach((p, idx) => {
              if (p.remainingTime > 0 && Number(p.arrivalTime) <= t && !readyQ.includes(idx)) {
                  readyQ.push(idx);
              }
          });
          
          if (readyQ.length > priorQueueLength) {
              queueHistory.push({
                  time: t,
                  queue: readyQ.map(idx => activeP[idx].id),
                  event: `CPU Idle until t=${t}. New arrivals added.`
              });
          }
          continue;
      }

      const currentIdx = readyQ.shift() as number;
      const p = activeP[currentIdx];

      const runTime = Math.min(p.remainingTime, currentQuantum);
      const oldTime = t;
      const endTime = t + runTime;
      
      timeline.push({ processId: p.id, startTime: oldTime, endTime: endTime });
      t = endTime;
      p.remainingTime -= runTime;

      let arrivalsDuringSlice = false;
      activeP.forEach((proc, idx) => {
          if (idx !== currentIdx && proc.remainingTime > 0 && !readyQ.includes(idx) && proc.arrivalTime > oldTime && proc.arrivalTime <= t) {
              readyQ.push(idx);
              arrivalsDuringSlice = true;
          }
      });
      
      if (arrivalsDuringSlice) {
          queueHistory.push({
              time: t,
              queue: readyQ.map(idx => activeP[idx].id),
              event: `New process(es) arrived during ${p.id} slice.`
          });
      }


      if (p.remainingTime > 0) {
          readyQ.push(currentIdx);
          
          queueHistory.push({
              time: t,
              queue: readyQ.map(idx => activeP[idx].id),
              event: `${p.id} preempted (moved to end of queue).`
          });
      } else {
          completedCount++;
          p.finishTime = t;
          p.turnaroundTime = p.finishTime - Number(p.arrivalTime);
          p.waitingTime = (p.turnaroundTime || 0) - Number(p.burstTime);
          complete.push({ ...p });

          queueHistory.push({
              time: t,
              queue: readyQ.map(idx => activeP[idx].id),
              event: `${p.id} finished execution.`
          });
      }
  }
  
  return { timeline, complete, queueHistory };
};

const ProcessInputList: React.FC<{
    inputProcesses: Process[],
    currentProcessColor: (id: string) => string,
    handleAddProcess: () => void,
    handleRemoveProcess: (idx: number) => void,
    handleUpdateProcess: (idx: number, field: keyof Process, val: string) => void
}> = ({ inputProcesses, currentProcessColor, handleAddProcess, handleRemoveProcess, handleUpdateProcess }) => (
    <div className="bg-[#F2E0D2]/80 backdrop-blur-md border border-[#F9CBD6] p-6 rounded-3xl shadow-xl min-h-[300px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[#9E182B]">Processes</h2>
            <button onClick={handleAddProcess} className="p-2 bg-[#F9CBD6] text-[#9E182B] rounded-full hover:bg-[#F2AFBC] hover:text-white transition-colors shadow-sm">
                <Plus className="w-5 h-5" />
            </button>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#F2AFBC]">
            {inputProcesses.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                    <Plus className="w-12 h-12 mb-2" />
                    <p className="text-sm font-medium">Add a process to start</p>
                </div>
            )}
            {inputProcesses.map((p, idx) => (
                <div key={p.id} className="group flex items-center bg-white p-3 rounded-2xl shadow-sm border border-[#F9CBD6] transition-all hover:border-[#F2AFBC]">
                    <div className={`w-3 h-10 rounded-full mr-3 ${currentProcessColor(p.id)}`}></div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase">Arrival</label>
                            <input 
                                type="number" min="0" placeholder="0"
                                className="w-full text-sm font-bold text-slate-700 bg-transparent border-b border-[#F9CBD6] focus:border-[#F2AFBC] outline-none placeholder:text-slate-300"
                                value={p.arrivalTime}
                                onChange={(e) => handleUpdateProcess(idx, 'arrivalTime', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase">Burst</label>
                            <input 
                                type="number" min="1" placeholder="-"
                                className="w-full text-sm font-bold text-slate-700 bg-transparent border-b border-[#F9CBD6] focus:border-[#F2AFBC] outline-none placeholder:text-slate-300"
                                value={p.burstTime}
                                onChange={(e) => handleUpdateProcess(idx, 'burstTime', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="ml-2 font-bold text-slate-300 text-lg select-none">{p.id}</div>
                    <button onClick={() => handleRemoveProcess(idx)} className="ml-2 text-slate-300 hover:text-[#9E182B] opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    </div>
);

const GanttChartAndLog: React.FC<{
    schedule: TimeSlice[],
    currentTime: number,
    isPlaying: boolean,
    currentRunningId: string | null,
    currentReadyQueue: string[],
    currentProcessColor: (id: string) => string,
}> = ({ schedule, currentTime, isPlaying, currentRunningId, currentReadyQueue, currentProcessColor }) => (
    <>
        <div className="mb-8 pt-6 md:pt-0">
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">CPU Core</h3>
            <div className="h-28 w-full bg-white rounded-2xl border border-[#F9CBD6] flex items-center justify-center relative overflow-hidden">
                {currentRunningId ? (
                    <div className="relative z-10 animate-pulse flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-2xl shadow-lg transform rotate-3 flex items-center justify-center text-white font-bold text-xl ${currentProcessColor(currentRunningId)}`}>
                            {currentRunningId}
                        </div>
                        <span className="mt-2 text-xs font-bold text-[#9E182B] bg-[#F9CBD6] px-2 py-0.5 rounded-full">Running</span>
                    </div>
                ) : (
                    <span className="text-slate-400 font-bold italic">Idle</span>
                )}
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')]"></div>
            </div>
        </div>

        <div className="mb-10">
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex justify-between items-center">
                <span className="flex items-center"><ListOrdered className="w-4 h-4 mr-1 text-[#9E182B]"/> Ready Queue (Current State: First to Last)</span>
                <span className="text-xs text-[#9E182B] font-bold">{currentReadyQueue.length} Processes Waiting</span>
            </h3>
            
            <div className="h-16 w-full bg-white rounded-xl border border-[#F9CBD6] flex items-center px-4 overflow-x-auto scrollbar-thin scrollbar-thumb-[#F2AFBC]">
                {currentReadyQueue.length === 0 && <span className="text-slate-400 text-sm italic w-full text-center">Queue empty</span>}
                
                <div className="flex items-center space-x-2 min-w-full justify-start">
                    {currentReadyQueue.map((pid, i) => (
                        <React.Fragment key={pid + i}>
                            <div className={`h-8 px-3 flex items-center justify-center text-white font-bold text-sm rounded-lg shadow-sm ${currentProcessColor(pid)}`}>
                                {pid}
                            </div>
                            {i < currentReadyQueue.length - 1 && (
                                <span className="text-slate-400 font-bold text-xl">→</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>

        <div className="mb-10">
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Gantt Chart (CPU Execution)</h3>
            
            <div className="h-28 w-full bg-white rounded-xl border border-[#F9CBD6] relative overflow-hidden flex items-start pt-4">
                <div className="absolute inset-0 flex items-start h-full w-full overflow-x-auto scrollbar-thin scrollbar-thumb-[#F2AFBC] pb-2 px-8">
                    
                    {schedule.map((slice, i) => {
                        if (isPlaying && slice.startTime > currentTime) return null;
                        
                        const width = (slice.endTime - slice.startTime) * WIDTH_SCALE;
                        
                        return (
                            <div 
                                key={i} 
                                style={{ width: `${width}px` }}
                                className="relative h-12 flex-shrink-0 group"
                            >
                                <div className={`h-full w-full flex items-center justify-center text-xs font-bold text-white/90 border-r border-white/20 shadow-sm ${slice.processId ? (currentProcessColor(slice.processId)) : 'bg-slate-100 text-slate-400'}`}>
                                    {slice.processId || 'Idle'}
                                </div>

                                {i === 0 && (
                                    <div className="absolute -bottom-8 left-0 -translate-x-1/2 flex flex-col items-center">
                                        <div className="h-2 w-px bg-slate-400 mb-1"></div>
                                        <span className="text-xs font-mono font-bold text-slate-600">{slice.startTime}</span>
                                    </div>
                                )}

                                <div className="absolute -bottom-8 right-0 translate-x-1/2 flex flex-col items-center z-10">
                                    <div className="h-2 w-px bg-slate-400 mb-1"></div>
                                    <span className="text-xs font-mono font-bold text-slate-600">{slice.endTime}</span>
                                </div>
                            </div>
                        );
                    })}
                    
                    {isPlaying && schedule.length > 0 && (
                        <div 
                            className="absolute top-0 bottom-8 border-l-2 border-[#9E182B] border-dashed z-20 pointer-events-none transition-all duration-1000 ease-linear"
                            style={{ left: `${32 + (currentTime * WIDTH_SCALE)}px` }} 
                        >
                            <div className="bg-[#9E182B] text-white text-[10px] px-1 rounded-sm absolute -top-1 -left-3">
                                {currentTime}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {schedule.length > 0 && (
            <div className="bg-[#F2E0D2]/80 backdrop-blur-md border border-[#F9CBD6] p-6 rounded-3xl shadow-xl animate-in slide-in-from-bottom fade-in duration-500">
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-thin scrollbar-thumb-[#F2AFBC] pb-2"></div>
                <h3 className="text-xl font-bold text-[#9E182B] mb-4 flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-[#9E182B]" /> Execution Sequence Log (Full Service Order)
                </h3>
                
                <div className="w-full bg-white rounded-xl border border-[#F9CBD6] relative overflow-hidden p-4">
                    <div className="flex items-center space-x-2 overflow-x-auto scrollbar-thin scrollbar-thumb-[#F2AFBC] pb-2">
                        {schedule.map((slice, i) => {
                            const pid = slice.processId;
                            
                            if (!pid) return null; 

                            const isPast = slice.endTime <= currentTime;
                            const opacity = isPast ? 'opacity-40' : 'opacity-100';
                            const colorClass = currentProcessColor(pid);
                            
                            const nextProcessExists = schedule.slice(i + 1).some(s => s.processId !== null);
                            
                            return (
                                <React.Fragment key={i}>
                                    <div 
                                        className={`h-8 px-3 flex items-center justify-center font-bold text-sm rounded-lg shadow-sm flex-shrink-0 transition-opacity duration-500 ${colorClass} text-white ${opacity}`}
                                    >
                                        {pid}
                                    </div>
                                    {nextProcessExists && (
                                        <span 
                                            className={`font-bold text-xl flex-shrink-0 transition-opacity duration-500 ${isPast ? 'text-slate-400 opacity-40' : 'text-slate-700'}`}
                                        >
                                            →
                                        </span>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
    </>
);

export default function RoundRobinScheduler() {
  const [inputProcesses, setInputProcesses] = useState<Process[]>([]);
  const [quantum, setQuantum] = useState<number | string>(''); 

  const [schedule, setSchedule] = useState<TimeSlice[]>([]);
  const [queueHistory, setQueueHistory] = useState<QueueSnapshot[]>([]); 
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedProcesses, setCompletedProcesses] = useState<Process[]>([]);
  const [currentRunningId, setCurrentRunningId] = useState<string | null>(null);
  const [currentReadyQueue, setCurrentReadyQueue] = useState<string[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentProcessColor = (id: string) => inputProcesses.find(p => p.id === id)?.color || 'bg-slate-300';


  const handleAddProcess = () => {
    const newId = `P${inputProcesses.length + 1}`;
    setInputProcesses([...inputProcesses, {
      id: newId,
      arrivalTime: '', burstTime: '', remainingTime: 0,
      color: COLORS[inputProcesses.length % COLORS.length]
    }]);
  };

  const handleRemoveProcess = (idx: number) => {
    const newP = [...inputProcesses];
    newP.splice(idx, 1);
    setInputProcesses(newP);
  };

  const handleUpdateProcess = (idx: number, field: keyof Process, val: string) => {
    const newP = [...inputProcesses];
    // @ts-ignore
    newP[idx][field] = val; 
    if (field === 'burstTime') {
        newP[idx].remainingTime = val === '' ? 0 : Number(val);
    }
    setInputProcesses(newP);
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentReadyQueue([]);
    setCurrentRunningId(null);
    setSchedule([]);
    setQueueHistory([]);
    setCompletedProcesses([]);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const togglePlay = () => {
    const currentQuantum = (typeof quantum === 'number' && quantum > 0) ? quantum : (quantum === '' ? 0 : Number(quantum));
    const validQuantum = currentQuantum > 0;
    const validProcesses = inputProcesses.length > 0 && inputProcesses.some(p => p.burstTime !== '' && Number(p.burstTime) > 0);
    
    if (!validQuantum || !validProcesses) {
        console.error("Validation Error: Ensure Time Quantum is set (>0) and at least one process has a valid Burst Time (>0).");
        return;
    }
    
    if (isPlaying) {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setIsPlaying(true);
      const { timeline, complete, queueHistory } = runSimulation(inputProcesses, quantum);
      setSchedule(timeline);
      setCompletedProcesses(complete);
      setQueueHistory(queueHistory);
    }
  };


  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const totalDuration = schedule.length > 0 ? schedule[schedule.length - 1].endTime : 0;
          if (prev >= totalDuration) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return totalDuration;
          }
          return prev + 1; 
        });
      }, 1000); 
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, schedule]);

  useEffect(() => {
    if (!schedule.length) {
        setCurrentRunningId(null);
        setCurrentReadyQueue([]);
        return;
    }

    const currentSlice = schedule.find(s => currentTime >= s.startTime && currentTime < s.endTime);
    setCurrentRunningId(currentSlice ? currentSlice.processId : null);

    const relevantSnapshot = queueHistory
        .filter(snapshot => snapshot.time <= currentTime)
        .sort((a, b) => b.time - a.time)[0]; 

    setCurrentReadyQueue(relevantSnapshot ? relevantSnapshot.queue : []);

  }, [currentTime, schedule, queueHistory]);


  const getAvgWait = () => {
    if (completedProcesses.length === 0) return 0;
    const total = completedProcesses.reduce((acc, p) => acc + (p.waitingTime || 0), 0);
    return (total / completedProcesses.length).toFixed(2);
  };
  const getAvgTurnaround = () => {
    if (completedProcesses.length === 0) return 0;
    const total = completedProcesses.reduce((acc, p) => acc + (p.turnaroundTime || 0), 0);
    return (total / completedProcesses.length).toFixed(2);
  };


  return (
    <div className="min-h-screen bg-[#F2E0D2] font-sans text-slate-700 selection:bg-[#F9CBD6] overflow-x-hidden relative pb-10">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-10 left-10 w-32 h-32 bg-[#F9CBD6] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-bounce delay-700"></div>
         <div className="absolute top-10 right-10 w-32 h-32 bg-[#F2AFBC] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-bounce delay-1000"></div>
         <div className="absolute -bottom-8 left-20 w-56 h-56 bg-[#F9CBD6] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-bounce delay-500"></div>
         <div className="absolute bottom-10 right-20 w-40 h-40 bg-[#F2AFBC] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        
        <header className="text-center space-y-2 mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#9E182B] to-[#F2AFBC]">
            Round Robin CPU Scheduling
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-[#F2E0D2]/80 backdrop-blur-md border border-[#F9CBD6] p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
              <h2 className="text-xl font-bold text-[#9E182B] mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-[#9E182B]" /> Configuration
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time Quantum (Δq)</label>
                  <div className="flex items-center mt-2">
                    <input 
                      type="number" min="1" 
                      placeholder="e.g., 2"
                      value={quantum} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuantum(val === '' ? '' : Math.max(1, Number(val)));
                      }}
                      className="w-full text-lg font-bold text-slate-700 bg-white border border-[#F9CBD6] focus:ring-[#F2AFBC] focus:border-[#F2AFBC] rounded-lg p-2 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button 
                    onClick={togglePlay}
                    disabled={!((typeof quantum === 'number' && quantum > 0) && inputProcesses.length > 0 && inputProcesses.some(p => p.burstTime !== '' && Number(p.burstTime) > 0))}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center transition-all ${
                      isPlaying 
                      ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                      : (typeof quantum !== 'number' || quantum <= 0 || inputProcesses.length === 0 || !inputProcesses.some(p => p.burstTime !== '' && Number(p.burstTime) > 0))
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-[#9E182B] to-[#F2AFBC] text-white shadow-lg hover:shadow-[#F2AFBC]/50 hover:-translate-y-1'
                    }`}
                  >
                    {isPlaying ? <><Pause className="w-5 h-5 mr-2" /> Pause</> : <><Play className="w-5 h-5 mr-2" /> Start</>}
                  </button>
                  <button 
                    onClick={resetSimulation}
                    className="p-3 bg-white text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <ProcessInputList 
                inputProcesses={inputProcesses}
                currentProcessColor={currentProcessColor}
                handleAddProcess={handleAddProcess}
                handleRemoveProcess={handleRemoveProcess}
                handleUpdateProcess={handleUpdateProcess}
            />
          </div>

          <div className="lg:col-span-8 space-y-6">
            
            <div className="bg-[#F2E0D2]/80 backdrop-blur-xl border border-[#F9CBD6] p-4 md:p-8 rounded-[2.5rem] shadow-2xl relative overflow-visible min-h-[400px]">
               <div className="absolute top-6 right-6 md:right-8 text-right z-20">
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Current Time</div>
                 <div className="text-4xl font-black text-[#9E182B] font-mono">{currentTime}<span className="text-lg text-slate-400">s</span></div>
               </div>
               
               <GanttChartAndLog
                   schedule={schedule}
                   currentTime={currentTime}
                   isPlaying={isPlaying}
                   currentRunningId={currentRunningId}
                   currentReadyQueue={currentReadyQueue}
                   currentProcessColor={currentProcessColor}
               />
               
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-[#F9CBD6] to-[#F2AFBC] rounded-full opacity-30 pointer-events-none"></div>
            </div>

            {completedProcesses.length > 0 && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom fade-in duration-700">
                <div className="bg-[#F2E0D2]/80 p-5 rounded-3xl shadow-lg border border-[#F9CBD6] text-center">
                  <div className="text-3xl font-black text-[#9E182B]">{getAvgWait()}s</div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Avg. Waiting Time</div>
                </div>
                <div className="bg-[#F2E0D2]/80 p-5 rounded-3xl shadow-lg border border-[#F9CBD6] text-center">
                  <div className="text-3xl font-black text-[#9E182B]">{getAvgTurnaround()}s</div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Avg. Turnaround</div>
                </div>
              </div>
            )}

            {completedProcesses.length > 0 && (
               <div className="bg-[#F2E0D2]/80 backdrop-blur-md rounded-3xl shadow-xl overflow-hidden border border-[#F9CBD6] mb-10">
                <div className="flex items-center space-x-2 overflow-x-auto scrollbar-thin scrollbar-thumb-[#F2AFBC] pb-2">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-[#F9CBD6] text-[#9E182B]">
                     <tr>
                       <th className="px-6 py-4 font-bold">Process</th>
                       <th className="px-6 py-4 font-bold">Arrival</th>
                       <th className="px-6 py-4 font-bold">Burst</th>
                       <th className="px-6 py-4 font-bold">Completion</th>
                       <th className="px-6 py-4 font-bold">Turnaround</th>
                       <th className="px-6 py-4 font-bold">Waiting</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#F9CBD6]">
                     {completedProcesses.sort((a,b) => a.id.localeCompare(b.id)).map(p => (
                       <tr key={p.id} className="hover:bg-[#F9CBD6]/30 transition-colors">
                         <td className="px-6 py-4 font-bold flex items-center">
                           <div className={`w-3 h-3 rounded-full mr-2 ${currentProcessColor(p.id)}`}></div> {p.id}
                         </td>
                         <td className="px-6 py-4 text-slate-600">{p.arrivalTime}</td>
                         <td className="px-6 py-4 text-slate-600">{p.burstTime}</td>
                         <td className="px-6 py-4 text-slate-600 font-medium">{p.finishTime}</td>
                         <td className="px-6 py-4 text-slate-600">{p.turnaroundTime}</td>
                         <td className="px-6 py-4 text-slate-600">{p.waitingTime}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 </div>
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
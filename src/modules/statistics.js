// ========== Statistics & Calendar Management ==========
import { getProfile, setProfile, getQuestions, getReview, getDailyRollup } from './database.js';

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function updateDailyStreak() {
  const profile = await getProfile();
  const today = todayStr();
  if (profile.lastStudy === today) {
    return; // Already studied today
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  
  if (profile.lastStudy === yesterdayStr) {
    profile.streak = (profile.streak || 0) + 1;
  } else if (profile.lastStudy !== today) {
    profile.streak = 1; // Reset streak if more than 1 day gap
  }
  
  profile.lastStudy = today;
  await setProfile(profile);
  
  // Update streak display
  const streakElement = document.getElementById('streak');
  if (streakElement) {
    streakElement.textContent = profile.streak;
  }
}

export async function updateStats() {
  const profile = await getProfile();
  const questions = await getQuestions();
  const review = await getReview();
  
  // 7일 롤링 정답률
  const roll = await getDailyRollup();
  const dates = Array.from({length:7}, (_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().slice(0,10); });
  let sumC=0, sumT=0, maxT=1;
  dates.forEach(d=>{ const r=roll[d]||{correct:0,total:0}; sumC+=r.correct; sumT+=r.total; if (r.total>maxT) maxT=r.total; });
  const rolling = sumT===0?0:Math.round((sumC/sumT)*100);

  // Due counts
  const today = todayStr();
  const tomorrow = (()=>{const t=new Date(today); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10);})();
  const weekEnd = (()=>{const t=new Date(today); t.setDate(t.getDate()+7); return t;})();
  const vals = Object.values(review);
  const dueToday = vals.filter(r=> r.due === today).length;
  const dueTomorrow = vals.filter(r=> r.due === tomorrow).length;
  const dueWeek = vals.filter(r=> { const d=new Date(r.due); return d>new Date(today) && d<=weekEnd; }).length;

  // 학습 통계 - Enhanced with better visuals
  const studiedProblems = Object.keys(review).length;
  const accuracyColor = rolling >= 80 ? '#10b981' : rolling >= 60 ? '#f59e0b' : '#ef4444';
  const streakColor = profile.streak >= 7 ? '#8b5cf6' : profile.streak >= 3 ? '#06b6d4' : '#6b7280';

  let statsHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:14px;border-radius:10px;color:white;text-align:center">
        <div style="font-size:20px;font-weight:bold;margin-bottom:2px">${studiedProblems}</div>
        <div style="opacity:0.9;font-size:11px">📚 학습한 문제</div>
      </div>
      <div style="background:linear-gradient(135deg,${accuracyColor} 0%,${accuracyColor}dd 100%);padding:14px;border-radius:10px;color:white;text-align:center">
        <div style="font-size:20px;font-weight:bold;margin-bottom:2px">${rolling}%</div>
        <div style="opacity:0.9;font-size:11px">🎯 7일 정답률</div>
      </div>
      <div style="background:linear-gradient(135deg,${streakColor} 0%,${streakColor}dd 100%);padding:14px;border-radius:10px;color:white;text-align:center">
        <div style="font-size:20px;font-weight:bold;margin-bottom:2px" id="streak">${profile.streak}</div>
        <div style="opacity:0.9;font-size:11px">🔥 연속 학습</div>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--card-bg);padding:10px;border-radius:8px;border:1px solid var(--border);text-align:center">
        <div style="font-size:18px;color:#ef4444;margin-bottom:2px">${dueToday}</div>
        <div style="font-size:10px;color:var(--muted)">📅 오늘</div>
      </div>
      <div style="background:var(--card-bg);padding:10px;border-radius:8px;border:1px solid var(--border);text-align:center">
        <div style="font-size:18px;color:#f59e0b;margin-bottom:2px">${dueTomorrow}</div>
        <div style="font-size:10px;color:var(--muted)">⏰ 내일</div>
      </div>
      <div style="background:var(--card-bg);padding:10px;border-radius:8px;border:1px solid var(--border);text-align:center">
        <div style="font-size:18px;color:#06b6d4;margin-bottom:2px">${dueWeek}</div>
        <div style="font-size:10px;color:var(--muted)">🗓️ 이번 주</div>
      </div>
    </div>

    <div style="background:var(--card-bg);padding:14px;border-radius:10px;border:1px solid var(--border);margin-bottom:16px;position:relative">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="font-size:14px;color:var(--text);margin:0;display:flex;align-items:center">
          <span style="font-size:16px;margin-right:6px">📅</span> 이번 주 학습
        </h3>
        <button onclick="openLearningCalendar()" style="background:var(--accent);color:white;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer">
          전체 보기
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;gap:2px;margin-bottom:8px" id="weeklyCalendar">
        <!-- Weekly calendar will be generated by JavaScript -->
      </div>
      <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px" id="streakMessage">
        ${profile.streak >= 7 ? '🚀 대단해요! 학습 습관이 완전히 자리잡았네요!' : 
          profile.streak >= 3 ? '👍 좋은 페이스로 가고 있어요!' : 
          profile.streak >= 1 ? '💪 시작이 반이에요!' : '오늘부터 새로운 학습을 시작해보세요!'}
      </div>
    </div>
  `;
  
  document.getElementById('statsContent').innerHTML = statsHtml;

  // Generate and populate weekly calendar
  const thisWeekDates = Array.from({length: 7}, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay() + i); // Get Sunday to Saturday
    return date;
  });

  let weeklyCalendarHtml = '';
  thisWeekDates.forEach(date => {
    const dateStr = date.toISOString().slice(0, 10);
    const dayRoll = roll[dateStr];
    const hasActivity = dayRoll && dayRoll.total > 0;
    const isToday = dateStr === today;
    const dayName = date.toLocaleDateString('ko-KR', { weekday: 'short' });
    
    weeklyCalendarHtml += `
      <div style="text-align:center;padding:6px;${isToday ? 'background:var(--accent);border-radius:6px;color:white' : ''}">
        <div style="font-size:10px;opacity:0.8;margin-bottom:2px">${dayName}</div>
        <div style="width:18px;height:18px;margin:0 auto;border-radius:3px;background:${hasActivity ? (isToday ? 'rgba(255,255,255,0.9)' : '#10b981') : 'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:${hasActivity && !isToday ? 'white' : 'inherit'}">
          ${hasActivity ? (dayRoll.total > 9 ? '9+' : dayRoll.total) : ''}
        </div>
        <div style="font-size:9px;margin-top:1px;opacity:0.7">${date.getDate()}</div>
      </div>
    `;
  });

  const weeklyCalendarElement = document.getElementById('weeklyCalendar');
  if (weeklyCalendarElement) {
    weeklyCalendarElement.innerHTML = weeklyCalendarHtml;
  }

  // Generate enhanced achievements
  await generateAchievements(roll, profile, questions, review);

  // Generate enhanced review schedule  
  await generateReviewSchedule(review, questions);

  // Generate enhanced top 10 difficult problems
  await generateDifficultProblems(review, questions);
}

export async function generateAchievements(roll, profile, questions, review) {
  // Enhanced Achievement System
  let achievementHtml = '';
  const studiedToday = roll[todayStr()]?.total || 0;
  const totalQuestions = questions.length;
  const completedQuestions = Object.keys(review).length;

  const achievements = [
    {name: '🔥 불타는 열정', desc: '7일 연속 학습', achieved: profile.streak >= 7, category: 'streak', progress: Math.min(profile.streak, 7), total: 7},
    {name: '⭐ 첫 발걸음', desc: '첫 문제 학습 완료', achieved: completedQuestions > 0, category: 'basic', progress: Math.min(completedQuestions, 1), total: 1},
    {name: '📚 지식 탐험가', desc: 'XP 1000 달성', achieved: profile.xp >= 1000, category: 'xp', progress: Math.min(profile.xp, 1000), total: 1000},
    {name: '🎯 정확한 저격수', desc: '7일 정답률 80%', achieved: false, category: 'accuracy', progress: 0, total: 80},
    {name: '💪 오늘의 승부사', desc: '하루 10문제 학습', achieved: studiedToday >= 10, category: 'daily', progress: Math.min(studiedToday, 10), total: 10},
    {name: '🏆 마스터 클래스', desc: '문제 50개 학습', achieved: completedQuestions >= 50, category: 'master', progress: Math.min(completedQuestions, 50), total: 50},
    {name: '🚀 스피드러너', desc: '하루 20문제 학습', achieved: studiedToday >= 20, category: 'speed', progress: Math.min(studiedToday, 20), total: 20},
    {name: '💎 다이아몬드', desc: 'XP 5000 달성', achieved: profile.xp >= 5000, category: 'legend', progress: Math.min(profile.xp, 5000), total: 5000}
  ];

  // Sort achievements: completed first, then by progress  
  achievements.sort((a, b) => {
    if (a.achieved && !b.achieved) return -1;
    if (!a.achieved && b.achieved) return 1;
    return (b.progress / b.total) - (a.progress / a.total);
  });

  achievements.forEach(a => {
    const progressPercent = Math.round((a.progress / a.total) * 100);
    const categoryColors = {
      streak: '#ff6b6b',
      basic: '#51cf66', 
      xp: '#ffd43b',
      accuracy: '#339af0',
      daily: '#ff8cc8',
      master: '#9775fa',
      speed: '#ff922b',
      legend: '#20c997'
    };
    const categoryColor = categoryColors[a.category] || '#868e96';
    
    achievementHtml += `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;position:relative;${a.achieved ? 'border-color:' + categoryColor + ';box-shadow:0 0 0 1px ' + categoryColor + '33' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center">
            <div style="font-size:18px;font-weight:600;color:var(--text);${a.achieved ? 'color:' + categoryColor : ''}">
              ${a.name} ${a.achieved ? '✨' : ''}
            </div>
          </div>
          <div style="font-size:24px;${a.achieved ? 'transform:scale(1.2)' : 'opacity:0.3'}">${a.achieved ? '🏆' : '⏳'}</div>
        </div>
        
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${a.desc}</div>
        
        <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden;margin-bottom:4px">
          <div style="background:${a.achieved ? categoryColor : categoryColor + '66'};height:100%;width:${progressPercent}%;border-radius:3px;transition:all 0.3s ease"></div>
        </div>
        
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)">
          <span>${a.progress.toLocaleString()} / ${a.total.toLocaleString()}</span>
          <span style="font-weight:600;color:${a.achieved ? categoryColor : 'var(--muted)'}">${progressPercent}%</span>
        </div>
      </div>
    `;
  });

  if (achievements.length === 0) {
    achievementHtml = `
      <div style="text-align:center;padding:32px;color:var(--muted)">
        <div style="font-size:48px;margin-bottom:16px">🏆</div>
        <div style="font-size:16px;margin-bottom:8px">아직 성취할 수 있는 것이 없어요</div>
        <div style="font-size:14px">학습을 시작해보세요!</div>
      </div>
    `;
  }

  document.getElementById('achievementContent').innerHTML = achievementHtml;
}

export async function generateReviewSchedule(review, questions) {
  const today = todayStr();
  const todayDate = new Date(today);
  const upcoming = Object.entries(review)
    .filter(([id, r]) => new Date(r.due) > todayDate)
    .sort((a, b) => new Date(a[1].due) - new Date(b[1].due))
    .slice(0, 10);

  let scheduleHtml = '';
  if (upcoming.length > 0) {
    // Group by date for better organization
    const groupedByDate = {};
    upcoming.forEach(([id, r]) => {
      const date = r.due;
      if (!groupedByDate[date]) groupedByDate[date] = [];
      groupedByDate[date].push([id, r]);
    });
    
    Object.entries(groupedByDate).forEach(([date, items]) => {
      const dateObj = new Date(date);
      const isToday = date === today;
      const isTomorrow = dateObj.getTime() === new Date(today).getTime() + 24 * 60 * 60 * 1000;
      const isThisWeek = (dateObj - todayDate) / (1000 * 60 * 60 * 24) <= 7;
      
      let displayDate = date;
      if (isToday) displayDate = '오늘';
      else if (isTomorrow) displayDate = '내일';
      else if (isThisWeek) displayDate = dateObj.toLocaleDateString('ko-KR', { weekday: 'long', month: 'short', day: 'numeric' });
      else displayDate = dateObj.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      
      const urgencyColor = isToday ? '#ff6b6b' : isTomorrow ? '#ffa726' : isThisWeek ? '#66bb6a' : '#868e96';
      const urgencyIcon = isToday ? '🔥' : isTomorrow ? '⚡' : isThisWeek ? '📅' : '📆';
      
      scheduleHtml += `
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px;border-left:4px solid ${urgencyColor}">
          <div style="display:flex;align-items:center;margin-bottom:12px">
            <span style="font-size:20px;margin-right:8px">${urgencyIcon}</span>
            <div style="font-size:16px;font-weight:600;color:${urgencyColor}">${displayDate}</div>
            <div style="background:${urgencyColor}33;color:${urgencyColor};font-size:11px;padding:2px 8px;border-radius:12px;margin-left:auto">
              ${items.length}개 문제
            </div>
          </div>
          
          <div style="display:grid;gap:8px">
            ${items.map(([id, r]) => {
              const q = questions.find(q => q.id == id);
              if (!q) return '';
              
              const difficulty = r.ease < 2.0 ? '어려움' : r.ease < 2.5 ? '보통' : '쉬움';
              const difficultyColor = r.ease < 2.0 ? '#ff6b6b' : r.ease < 2.5 ? '#ffa726' : '#66bb6a';
              
              return `
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px">
                  <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                    <div style="font-size:14px;color:var(--text);line-height:1.4;flex:1;margin-right:8px">
                      ${escapeHtml(q.prompt.substring(0, 60))}${q.prompt.length > 60 ? '...' : ''}
                    </div>
                    <span style="background:${difficultyColor}22;color:${difficultyColor};font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap">
                      ${difficulty}
                    </span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:11px;color:var(--muted)">간격: ${r.interval || 0}일</span>
                    <span style="font-size:11px;color:var(--muted)">난이도: ${r.ease?.toFixed(1) || '2.5'}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
  } else {
    scheduleHtml = `
      <div style="text-align:center;padding:32px;color:var(--muted)">
        <div style="font-size:48px;margin-bottom:16px">🎉</div>
        <div style="font-size:16px;margin-bottom:8px">예정된 복습이 없습니다</div>
        <div style="font-size:14px">모든 복습을 완료했거나 새로운 문제를 추가해보세요!</div>
      </div>
    `;
  }
  
  document.getElementById('scheduleContent').innerHTML = scheduleHtml;
}

export async function generateDifficultProblems(review, questions) {
  // Enhanced Top 10 Difficult Problems
  const revArr = Object.entries(review).map(([id,r])=>({
    id: Number(id), 
    ease: r.ease ?? 2.5, 
    again: r.againCount||0,
    correct: r.correct || 0,
    total: r.count || 0
  }));
  revArr.sort((a,b)=> (a.ease - b.ease) || (b.again - a.again));
  const hardest = revArr.slice(0,10);

  let hardHtml = '';
  if (hardest.length === 0) {
    hardHtml = `
      <div style="text-align:center;padding:32px;color:var(--muted)">
        <div style="font-size:48px;margin-bottom:16px">🎯</div>
        <div style="font-size:16px;margin-bottom:8px">아직 충분한 학습 데이터가 없어요</div>
        <div style="font-size:14px">더 많은 문제를 풀어보세요!</div>
      </div>
    `;
  } else {
    hardest.forEach((item, index) => {
      const q = questions.find(q=> q.id == item.id);
      if (!q) return;
      
      const accuracy = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
      const difficultyLevel = item.ease < 1.5 ? '🔥' : item.ease < 2.0 ? '😵' : item.ease < 2.5 ? '😰' : '😅';
      const rankColor = index < 3 ? '#ff6b6b' : index < 6 ? '#ffa726' : '#66bb6a';
      
      hardHtml += `
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;position:relative">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center">
              <div style="background:${rankColor};color:white;font-weight:bold;font-size:12px;padding:4px 8px;border-radius:12px;margin-right:12px;min-width:24px;text-align:center">
                ${index + 1}
              </div>
              <div style="font-size:20px;margin-right:8px">${difficultyLevel}</div>
              <div style="font-size:14px;color:var(--text);font-weight:500">난이도 ${item.ease.toFixed(1)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:18px;font-weight:bold;color:${accuracy < 50 ? '#ff6b6b' : accuracy < 80 ? '#ffa726' : '#66bb6a'}">${accuracy}%</div>
              <div style="font-size:11px;color:var(--muted)">정답률</div>
            </div>
          </div>
          
          <div style="font-size:14px;color:var(--text);line-height:1.4;margin-bottom:8px">
            ${escapeHtml(q.prompt.substring(0, 80))}${q.prompt.length > 80 ? '...' : ''}
          </div>
          
          <div style="display:flex;gap:8px">
            <span style="background:rgba(255, 107, 107, 0.1);color:#ff6b6b;font-size:11px;padding:2px 6px;border-radius:4px">
              ${item.again}회 틀림
            </span>
            <span style="background:rgba(102, 187, 106, 0.1);color:#66bb6a;font-size:11px;padding:2px 6px;border-radius:4px">
              ${item.total}회 시도
            </span>
          </div>
        </div>
      `;
    });
  }

  const statsContainer = document.getElementById('statsContent');
  statsContainer.innerHTML += `
    <div style="background:var(--card-bg);padding:20px;border-radius:12px;border:1px solid var(--border);margin-top:24px">
      <h3 style="font-size:18px;color:var(--text);margin:0 0 16px 0;display:flex;align-items:center">
        <span style="font-size:24px;margin-right:8px">🎯</span> 어려운 문제 Top 10
      </h3>
      ${hardHtml}
    </div>
  `;
}

// Learning Calendar Functions
export async function openLearningCalendar() {
  const roll = await getDailyRollup();
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Generate calendar for current and previous 2 months
  const months = [];
  for (let i = 2; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    months.push(date);
  }
  
  let calendarHtml = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:14px;color:var(--muted);margin-bottom:8px">학습 활동이 있는 날에는 숫자가 표시됩니다</div>
    </div>
  `;
  
  months.forEach(monthDate => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    
    // Get first day of month and last day
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    calendarHtml += `
      <div style="margin-bottom:30px">
        <h4 style="text-align:center;margin:0 0 16px 0;color:var(--text)">${monthName}</h4>
        <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:4px;max-width:400px;margin:0 auto">
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">일</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">월</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">화</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">수</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">목</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">금</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">토</div>
    `;
    
    // Generate calendar days
    const currentDate = new Date(startDate);
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        const dayRoll = roll[dateStr];
        const hasActivity = dayRoll && dayRoll.total > 0;
        const isToday = dateStr === todayStr();
        const isCurrentMonth = currentDate.getMonth() === month;
        const dayNum = currentDate.getDate();
        
        let cellStyle = 'text-align:center;padding:8px;border-radius:6px;min-height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;';
        
        if (!isCurrentMonth) {
          cellStyle += 'color:var(--muted);opacity:0.3;';
        } else if (isToday) {
          cellStyle += 'background:var(--accent);color:white;font-weight:bold;';
        } else if (hasActivity) {
          cellStyle += 'background:#10b981;color:white;font-weight:600;';
        } else {
          cellStyle += 'color:var(--text);';
        }
        
        const content = hasActivity ? (dayRoll.total > 9 ? '9+' : dayRoll.total) : dayNum;
        calendarHtml += `<div style="${cellStyle}" title="${dateStr}: ${hasActivity ? dayRoll.total + '개 문제 학습' : '학습 없음'}">${content}</div>`;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      // Check if we've covered all days of the month
      if (currentDate.getMonth() !== month) break;
    }
    
    calendarHtml += `
        </div>
      </div>
    `;
  });
  
  document.getElementById('calendarContent').innerHTML = calendarHtml;
  document.getElementById('calendarModal').style.display = 'flex';
}

export function closeLearningCalendar() {
  document.getElementById('calendarModal').style.display = 'none';
}

// Utility function that needs to be available
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

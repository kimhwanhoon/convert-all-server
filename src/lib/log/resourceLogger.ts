import os from 'os';
import fs from 'fs';
import path from 'path';

// 로그를 저장할 배열 선언
let logHistory: any[] = [];

const resourceLogger = () => {
  const memoryUsage = process.memoryUsage(),
    freeMem = os.freemem(),
    totalMem = os.totalmem(),
    cpuUsage = process.cpuUsage();

  const usage = {
    timestamp: new Date(),
    memory: {
      rss: `${Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100} MB`, // RSS 메모리
      heapTotal: `${Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100} MB`, // 총 힙 메모리
      heapUsed: `${Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100} MB`, // 사용중인 힙 메모리
      freeMem: `${Math.round((freeMem / 1024 / 1024) * 100) / 100} MB`, // 여유 메모리
      totalMem: `${Math.round((totalMem / 1024 / 1024) * 100) / 100} MB`, // 전체 메모리
      usagePercent: `${Math.round((1 - freeMem / totalMem) * 100)}%`, // 메모리 사용률
    },
    cpu: {
      user: `${Math.round(cpuUsage.user / 1000000)}ms`, // 유저 CPU 시간
      system: `${Math.round(cpuUsage.system / 1000000)}ms`, // 시스템 CPU 시간
    },
  };

  // 로그 히스토리에 저장
  logHistory.push(usage);

  // 1분이 지난 로그는 제거
  const logDuration = isNaN(Number(process.env.LOG_DURATION))
      ? 60
      : Number(process.env.LOG_DURATION),
    oneMinuteAgo = new Date(Date.now() - logDuration * 1000);

  logHistory = logHistory.filter(
    (log) => new Date(log.timestamp) > oneMinuteAgo
  );

  console.log(usage);
};

// 로그 저장 함수 추가
export const saveLogsToFile = async () => {
  // 10초 기다렸다가 진행 -> 메모리 최대 사용 후 얼마나 내려가는지 확인하기 위함
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-'),
    fileName = `resource-logs-${timestamp}.txt`,
    logDir = path.join(process.cwd(), 'src', 'log');

  // logs 디렉토리가 없으면 생성
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logContent = logHistory
    .map((log) => JSON.stringify(log, null, 2))
    .join('\n\n');
  fs.writeFileSync(path.join(logDir, fileName), logContent);

  return fileName;
};

export default resourceLogger;

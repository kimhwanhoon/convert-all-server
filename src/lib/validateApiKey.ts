import { NextFunction, Request, Response } from 'express';

const adminAccessPoints = ['/health/log'];

// 토큰 검증 함수
const validateToken = (
  token: string,
  requiredToken: string | undefined
): boolean => {
  return token === requiredToken;
};

// API 키 확인 미들웨어
export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 홈 경로 요청 예외 처리
  if (req.method === 'GET' && req.path === '/') {
    return next();
  }

  // Authorization 헤더 검증
  const { authorization } = req.headers;

  // Authorization 헤더가 Bearer 토큰 형식이 아니면 403 에러 반환
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(403).send('Forbidden: Invalid Authorization Header');
  }

  const token = authorization.split(' ')[1];

  // 관리자 접근 검증
  if (adminAccessPoints.includes(req.path)) {
    if (!validateToken(token, process.env.ADMIN_ACCESS_TOKEN)) {
      return res.status(403).send('Forbidden: Invalid Admin Access Token');
    }
    return next();
  }

  // 일반 API 키 검증
  if (!validateToken(token, process.env.API_KEY)) {
    return res.status(403).send('Forbidden: Invalid API Key');
  }

  next();
};

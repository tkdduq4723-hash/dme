# 매일 아침 브리핑

GitHub Actions에서 매일 한국 시간 오전 8시에 `send_briefing.py`를 실행합니다.
컴퓨터가 꺼져 있어도 GitHub 서버가 실행합니다. GitHub 예약 실행은 부하에 따라 지연될 수 있습니다.

## 처음 연결하기

1. GitHub에서 비공개 저장소를 만듭니다.
2. `send_briefing.py`와 `.github/workflows/daily-briefing.yml`, `.gitignore`를 저장소 기본 브랜치에 올립니다. `.github` 폴더 구조를 유지해야 합니다. `.env`는 올리지 않습니다.
3. 저장소 Settings → Secrets and variables → Actions → New repository secret에서 다음 세 항목을 등록합니다.
   - `GMAIL_USER`: 발신 Gmail 주소 (기존 `.env`의 같은 항목)
   - `GMAIL_APP_PASS`: Gmail 앱 비밀번호 (기존 `.env`의 같은 항목)
   - `RECIPIENT_EMAIL`: 브리핑을 받을 이메일 주소
4. Actions에서 `Daily morning briefing`이 표시되고 활성화되어 있는지 확인합니다.
5. 즉시 시험 발송하려면 Actions → Daily morning briefing → Run workflow를 누릅니다. 실제 이메일 한 통이 전송됩니다.

GitHub 연결과 Secrets 등록 전에는 자동 발송이 활성화되지 않습니다.
기존 Windows 작업 스케줄러에도 같은 작업이 있으면 클라우드 실행 확인 후 중복 발송을 막기 위해 끕니다.
비공개 저장소의 Actions 사용량은 계정의 포함 실행 시간과 결제 설정을 따릅니다.
공개 저장소는 60일간 저장소 활동이 없으면 예약 실행이 비활성화될 수 있습니다.

## 동작 확인

실행이 실패하면 Actions 실행 로그를 확인합니다. Secrets 누락과 SMTP 전송 실패는 실패 상태로 표시됩니다.
Python 표준 라이브러리만 사용하므로 추가 패키지는 필요 없습니다.
명언은 실행할 때마다 [kadvice 공개 한국어 명언 자료](https://github.com/chkim116/kadvice)의 생활·동기부여·기타 목록을 인터넷에서 불러와 무작위로 선택합니다. 코드에 고정 명언 목록을 저장하지 않습니다. 모든 자료 조회가 실패하면 명언을 불러오지 못했다는 안내를 표시하며 브리핑은 계속 발송합니다. 무작위 선택이므로 이전 명언과 중복될 수 있습니다.
브리핑의 기존 뉴스·증시 수집 및 실패 시 대체 데이터 동작은 그대로 사용합니다.

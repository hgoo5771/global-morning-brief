import os
import json
from datetime import datetime, timedelta, timezone
import feedparser
from dotenv import load_dotenv
from google import genai

# ===== 설정 (여기 숫자만 바꿔서 조절해요) =====
HOURS = 16        # 몇 시간 전 기사까지 가져올지
ITEM_COUNT = 15   # AI가 고를 기사 수

FEEDS = [
    {"name": "CNBC", "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html"},
    {"name": "CNBC", "url": "https://www.cnbc.com/id/20910258/device/rss/rss.html"},
    {"name": "CNBC", "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"name": "BBC", "url": "https://feeds.bbci.co.uk/news/business/rss.xml"},
    {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"},
    {"name": "연합뉴스", "url": "https://www.yna.co.kr/rss/economy.xml"},
]

KST = timezone(timedelta(hours=9))   # 한국 시간대

# 1. API 키 읽기 + Gemini 연결
load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 2. 여러 출처에서 "최근 HOURS시간 안" 기사만 모으기
now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=HOURS)   # 기준 시각
seen_links = set()      # 이미 넣은 기사 링크 (중복 방지용)
link_times = {}         # 기사 링크 → 발행 시각 (타임라인용)
news_text = ""
count = 0

for source in FEEDS:
    feed = feedparser.parse(source["url"])
    print(source["name"], "→ 기사", len(feed.entries), "개 확인")

    for entry in feed.entries:
        # 발행 시각이 없는 기사는 건너뛰기
        if not entry.get("published_parsed"):
            continue

        # 발행 시각이 기준보다 오래됐으면 건너뛰기
        published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        if published < cutoff:
            continue

        # 이미 넣은 기사면 건너뛰기
        if entry.link in seen_links:
            continue
        seen_links.add(entry.link)
        link_times[entry.link] = published.isoformat()

        news_text += "- 출처: " + source["name"] + "\n"
        news_text += "  제목: " + entry.title + "\n"
        news_text += "  내용: " + entry.get("summary", "") + "\n"
        news_text += "  링크: " + entry.link + "\n"
        count += 1

print("최근", HOURS, "시간 기사 총", count, "개를 AI에게 보냅니다")

# 기사가 하나도 없으면 여기서 멈추기 (빈 브리핑 방지)
if count == 0:
    raise SystemExit("가져온 기사가 없어서 멈춥니다. HOURS 숫자를 늘려 보세요.")

# 3. 프롬프트
prompt = f"""
너는 한국 직장인을 위한 경제뉴스 에디터야.
아래는 지난밤 사이 나온 기사 목록이야.
경제·금융·산업 관련 중요한 기사 {ITEM_COUNT}개를 골라 정리해 줘.

규칙:
- 모든 문장은 한국어로 써.
- 기사에 적힌 사실만 써. 기사에 없는 숫자, 전망, 해석은 절대 덧붙이지 마.
- 같은 사건을 다룬 기사가 여러 개면 하나로 합쳐.
- 각 기사 요약은 2~4문장. 내용이 적으면 짧게 써도 돼.
- category는 다음 중 하나만: GLOBAL ECONOMY, FINANCIAL MARKETS, TECHNOLOGY & INDUSTRY, ENERGY & COMMODITIES, KOREA
- source와 url은 기사 목록에 있는 값을 글자 하나 바꾸지 말고 그대로 써.
- summary에는 밤사이 전체 흐름을 3~4문장으로 정리해. 이것도 기사 내용만 근거로 써.

반드시 아래 JSON 형식으로만 답해:
{{
  "summary": "밤사이 전체 흐름 3~4문장",
  "items": [
    {{"category": "분류", "title": "한국어 제목", "summary": "요약", "source": "출처", "url": "링크"}}
  ]
}}

기사 목록:
{news_text}
"""

# 4. Gemini 호출
print("AI가 요약하는 중... (20~40초 걸려요)")
response = client.models.generate_content(
    model="gemini-3.6-flash",
    contents=prompt,
    config={"response_mime_type": "application/json"},
)

# 5. AI의 답을 Python 데이터로 바꾸기
brief = json.loads(response.text)

# 6. AI가 고른 기사마다 발행 시각을 붙이기 (링크로 찾아요)
for item in brief["items"]:
    item["published"] = link_times.get(item.get("url"))

# 7. 날짜와 "몇 시부터 몇 시까지" 범위 기록 (타임라인용)
# (GitHub 서버는 영국 시간으로 돌아가서, 한국 날짜를 꼭 지정해야 해요)
brief["date"] = datetime.now(KST).strftime("%Y-%m-%d")
brief["window_start"] = cutoff.isoformat()
brief["window_end"] = now.isoformat()

# 8. 저장
with open("brief.json", "w", encoding="utf-8") as f:
    json.dump(brief, f, ensure_ascii=False, indent=2)

print("brief.json 저장 완료! 기사", len(brief["items"]), "개")

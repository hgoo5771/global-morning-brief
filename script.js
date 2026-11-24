// =================================
// GLOBAL MORNING BRIEF - script.js
// brief.json을 읽어서 화면에 그리는 파일
// =================================


// ---------------------------------
// 0. 카테고리 설정
// summarize.py의 프롬프트에 적은 category 이름과 똑같아야 해요.
// 순서를 바꾸면 화면에 나오는 순서도 바뀌어요.
// ---------------------------------

const CATEGORIES = [
    { key: "GLOBAL ECONOMY",        name: "글로벌 경제",   color: "#7fb4ff" },
    { key: "FINANCIAL MARKETS",     name: "금융시장",      color: "#5fd4b0" },
    { key: "TECHNOLOGY & INDUSTRY", name: "기술·산업",     color: "#b79cff" },
    { key: "ENERGY & COMMODITIES",  name: "에너지·원자재", color: "#ff9b73" },
    { key: "KOREA",                 name: "한국",          color: "#ffd166" }
];

// 위 목록에 없는 분류가 오면 여기로 모아요
const OTHER = { key: "OTHER", name: "기타", color: "#9aa3bd" };

function findCategory(key) {
    return CATEGORIES.find(function (c) { return c.key === key; }) || OTHER;
}


// ---------------------------------
// 1. 날짜·시간 표시용 함수
// ---------------------------------

// "2026-11-24" → "11월 24일 화요일"
function formatDate(dateText) {
    const date = new Date(dateText + "T00:00:00+09:00");
    return date.toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "long",
        timeZone: "Asia/Seoul"
    });
}

// 국제 표준 시각 → 한국 시각 "02:14"
function formatKstTime(isoText) {
    return new Date(isoText).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Seoul"
    });
}

// 한국 시각 기준 "어제 15:00" / "오늘 07:00"
function formatKstDayTime(isoText, briefDate) {
    const kstDate = new Date(isoText).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const day = kstDate === briefDate ? "오늘" : "어제";
    return day + " " + formatKstTime(isoText);
}


// ---------------------------------
// 2. 기사들을 카테고리별로 묶기
// 결과: [{ category, items: [...] }, ...]
// ---------------------------------

function groupByCategory(items) {
    const order = CATEGORIES.concat([OTHER]);

    const groups = order.map(function (category) {
        const groupItems = items.filter(function (item) {
            return findCategory(item.category) === category;
        });

        // 같은 카테고리 안에서는 시간 순서대로 (밤 → 아침)
        groupItems.sort(function (a, b) {
            if (!a.published) return 1;
            if (!b.published) return -1;
            return new Date(a.published) - new Date(b.published);
        });

        return { category: category, items: groupItems };
    });

    // 기사가 하나도 없는 카테고리는 빼요
    return groups.filter(function (group) { return group.items.length > 0; });
}


// ---------------------------------
// 3. 화면 그리기
// ---------------------------------

// 3-1. 카테고리 바로가기 버튼들
function renderNav(groups) {
    const nav = document.getElementById("cat-nav");
    nav.innerHTML = "";

    groups.forEach(function (group, index) {
        const link = document.createElement("a");
        link.href = "#cat-" + index;
        link.className = "cat-chip";
        link.style.setProperty("--cat", group.category.color);

        const name = document.createElement("span");
        name.textContent = group.category.name;

        const count = document.createElement("span");
        count.className = "cat-chip-count";
        count.textContent = group.items.length;

        link.append(name, count);
        nav.appendChild(link);
    });
}

// 3-2. 기사 1건
function createStory(item, storyId) {
    const article = document.createElement("article");
    article.className = "story";
    article.id = storyId;

    const time = document.createElement("time");
    time.className = "story-time";
    if (item.published) {
        time.dateTime = item.published;
        time.textContent = formatKstTime(item.published);
    } else {
        time.textContent = "–";
    }

    const body = document.createElement("div");
    body.className = "story-body";

    const title = document.createElement("h4");
    title.textContent = item.title;

    const summary = document.createElement("p");
    summary.textContent = item.summary;

    const source = document.createElement("a");
    source.className = "story-source";
    source.href = item.url;
    source.target = "_blank";
    source.rel = "noopener";
    source.textContent = item.source + " 원문 보기";

    body.append(title, summary, source);
    article.append(time, body);
    return article;
}

// 3-3. 카테고리별 묶음 전체
function renderGroups(groups) {
    const list = document.getElementById("news-list");
    list.innerHTML = "";

    groups.forEach(function (group, groupIndex) {
        const section = document.createElement("section");
        section.className = "group";
        section.id = "cat-" + groupIndex;
        section.style.setProperty("--cat", group.category.color);

        const head = document.createElement("header");
        head.className = "group-head";

        const heading = document.createElement("h3");
        heading.textContent = group.category.name;

        const count = document.createElement("span");
        count.className = "group-count";
        count.textContent = group.items.length + "건";

        head.append(heading, count);
        section.appendChild(head);

        group.items.forEach(function (item) {
            section.appendChild(createStory(item, item.storyId));
        });

        list.appendChild(section);
    });
}

// 3-4. 밤사이 타임라인
function renderTimeline(brief, groups) {
    const timeline = document.getElementById("timeline");

    // 시간 정보가 있는 기사만 점으로 찍어요
    const timedItems = [];
    groups.forEach(function (group) {
        group.items.forEach(function (item) {
            if (item.published) {
                timedItems.push({ item: item, color: group.category.color });
            }
        });
    });

    // 예전 형식의 brief.json이면 타임라인은 숨겨요
    if (!brief.window_start || !brief.window_end || timedItems.length === 0) {
        timeline.hidden = true;
        return;
    }
    timeline.hidden = false;

    const start = new Date(brief.window_start).getTime();
    const end = new Date(brief.window_end).getTime();

    // 시간 → 왼쪽에서 몇 % 위치인지
    function toPercent(time) {
        const percent = (time - start) / (end - start) * 100;
        return Math.min(100, Math.max(0, percent));
    }

    document.getElementById("timeline-range").textContent =
        formatKstDayTime(brief.window_start, brief.date) + " ~ " + formatKstDayTime(brief.window_end, brief.date);

    // ① 3시간마다 눈금 (한국 시각 기준)
    const ticks = document.getElementById("timeline-ticks");
    ticks.innerHTML = "";
    const HOUR = 60 * 60 * 1000;
    for (let t = Math.ceil(start / HOUR) * HOUR; t <= end; t += HOUR) {
        const kstHour = (new Date(t).getUTCHours() + 9) % 24;
        if (kstHour % 3 !== 0) continue;

        const tick = document.createElement("span");
        tick.className = "tick";
        tick.style.left = toPercent(t) + "%";
        tick.textContent = kstHour + "시";
        ticks.appendChild(tick);
    }

    // ② 기사마다 점 (가까이 붙은 점은 위아래로 비켜서 겹치지 않게)
    const dots = document.getElementById("timeline-dots");
    dots.innerHTML = "";
    timedItems.sort(function (a, b) {
        return new Date(a.item.published) - new Date(b.item.published);
    });

    // 점끼리 최소 16px은 떨어져야 같은 줄에 놓여요 (화면 폭에 맞춰 %로 계산)
    const minGap = 16 / dots.clientWidth * 100;
    const laneLastPosition = [-100, -100, -100];  // 3줄
    timedItems.forEach(function (entry, index) {
        const position = toPercent(new Date(entry.item.published).getTime());

        let lane = laneLastPosition.findIndex(function (last) { return position - last >= minGap; });
        if (lane === -1) lane = 0;
        laneLastPosition[lane] = position;

        const dot = document.createElement("a");
        dot.className = "dot";
        dot.href = "#" + entry.item.storyId;
        dot.style.left = position + "%";
        dot.style.setProperty("--lane", lane);
        dot.style.setProperty("--cat", entry.color);
        dot.style.animationDelay = (0.5 + index * 0.06) + "s";
        dot.setAttribute("aria-label", formatKstTime(entry.item.published) + " " + entry.item.title);
        dot.dataset.title = formatKstTime(entry.item.published) + "  " + entry.item.title;
        dots.appendChild(dot);
    });
}

// 3-5. 읽는 시간 계산 (한글 기준 1분에 약 500자)
function renderReadTime(brief) {
    let chars = (brief.summary || "").length;
    brief.items.forEach(function (item) {
        chars += item.title.length + item.summary.length;
    });
    const minutes = Math.max(1, Math.round(chars / 500));
    document.getElementById("read-time").textContent =
        "기사 " + brief.items.length + "건, 읽는 데 약 " + minutes + "분";
}


// ---------------------------------
// 4. brief.json 불러와서 전부 그리기
// ---------------------------------

async function loadBrief() {
    const list = document.getElementById("news-list");

    try {
        const response = await fetch("brief.json");
        const brief = await response.json();

        document.getElementById("today").textContent = formatDate(brief.date);
        document.getElementById("intro").textContent = brief.summary;

        const groups = groupByCategory(brief.items);

        // 기사마다 고유 번호(id)를 붙여요. 타임라인 점을 누르면 이 id로 이동해요.
        let number = 0;
        groups.forEach(function (group) {
            group.items.forEach(function (item) {
                item.storyId = "story-" + number;
                number++;
            });
        });

        renderReadTime(brief);
        renderNav(groups);
        renderGroups(groups);
        renderTimeline(brief, groups);
    } catch (error) {
        list.innerHTML = "";
        const message = document.createElement("p");
        message.className = "status";
        message.textContent = "브리핑을 불러오지 못했어요. 폴더에 brief.json이 있는지, Live Server로 열었는지 확인해 주세요.";
        list.appendChild(message);
        console.error(error);
    }
}

loadBrief();

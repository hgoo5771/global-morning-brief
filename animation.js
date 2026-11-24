// =================================
// GLOBAL MORNING BRIEF - animation.js
// 배경 효과만 담당하는 파일 (데이터는 script.js 담당)
// =================================

// 떠다니는 점들이 서로 가까워지면 선으로 이어지고,
// 마우스 근처의 점들은 마우스 쪽으로 선이 연결돼요.
// 화면 오른쪽(새벽 쪽)으로 갈수록 점 색이 따뜻해져요.

const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");

const LINK_DISTANCE = 130;   // 이 거리(px)보다 가까운 점끼리 연결
const MOUSE_DISTANCE = 180;  // 마우스와 이 거리 안의 점은 마우스와 연결

let points = [];
const mouse = { x: null, y: null };

// "움직임 줄이기" 설정을 켠 사용자에겐 멈춘 그림만 보여줘요
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setupCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const count = Math.floor((canvas.width * canvas.height) / 16000);

    points = [];
    for (let i = 0; i < count; i++) {
        points.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3
        });
    }
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// 왼쪽은 밤(파랑) → 오른쪽은 새벽(주황)으로 색을 섞어요
function pointColor(x, alpha) {
    const ratio = x / canvas.width;          // 0(왼쪽) ~ 1(오른쪽)
    const r = Math.round(127 + (242 - 127) * ratio);
    const g = Math.round(180 + (166 - 180) * ratio);
    const b = Math.round(255 + (90 - 255) * ratio);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ① 점 이동 + 그리기
    points.forEach(function (p) {
        if (!reduceMotion) {
            p.x += p.vx;
            p.y += p.vy;
        }
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = pointColor(p.x, 0.5);
        ctx.fill();
    });

    // ② 가까운 점끼리 선 연결
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const d = distance(points[i], points[j]);
            if (d < LINK_DISTANCE) {
                ctx.beginPath();
                ctx.moveTo(points[i].x, points[i].y);
                ctx.lineTo(points[j].x, points[j].y);
                ctx.strokeStyle = pointColor(points[i].x, (1 - d / LINK_DISTANCE) * 0.22);
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    // ③ 마우스 근처 점은 마우스와 연결
    if (mouse.x !== null) {
        points.forEach(function (p) {
            const d = distance(p, mouse);
            if (d < MOUSE_DISTANCE) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.strokeStyle = pointColor(p.x, (1 - d / MOUSE_DISTANCE) * 0.4);
                ctx.stroke();
            }
        });
    }

    if (!reduceMotion) {
        requestAnimationFrame(drawFrame);
    }
}

window.addEventListener("mousemove", function (event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
});

document.addEventListener("mouseleave", function () {
    mouse.x = null;
    mouse.y = null;
});

window.addEventListener("resize", function () {
    setupCanvas();
    if (reduceMotion) drawFrame();
});

setupCanvas();
drawFrame();

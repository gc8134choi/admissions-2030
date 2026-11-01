// 모듈이 늦게 불러와져도 policy.css가 빠지지 않게 한다(import만 하면 된다).
if (typeof document !== "undefined" && !document.getElementById("policy-css")) { const l = document.createElement("link"); l.id = "policy-css"; l.rel = "stylesheet"; l.href = "policy.css"; document.head.appendChild(l); }

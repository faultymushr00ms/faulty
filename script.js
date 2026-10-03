// Mobile menu
const toggle = document.querySelector(".nav__toggle");
const links = document.getElementById("nav-links");

toggle.addEventListener("click", () => {
  const open = links.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
});

links.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    links.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Fade sections in as they scroll into view
if ("IntersectionObserver" in window) {
  const items = document.querySelectorAll(".section__title, .section__intro, .card, .about, .contact__email");
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15 });

  items.forEach((el) => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}

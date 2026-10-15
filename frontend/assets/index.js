// Home page — interactive elements
document.addEventListener("DOMContentLoaded", () => {
  // "See How It Works" button → scroll to About section
  const howItWorksBtn = document.getElementById("howItWorksBtn");
  if (howItWorksBtn) {
    howItWorksBtn.addEventListener("click", () => {
      const about = document.getElementById("about-veridoc");
      if (about) {
        about.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // Citation chip hover → highlight the target card
  document.querySelectorAll(".citation-chip").forEach(chip => {
    const targetId = "card-" + chip.getAttribute("data-target");
    const targetCard = document.getElementById(targetId);

    if (!targetCard) return;

    chip.addEventListener("mouseenter", () => {
      targetCard.classList.add("bg-surface-container-high", "scale-[1.02]");
    });

    chip.addEventListener("mouseleave", () => {
      targetCard.classList.remove("bg-surface-container-high", "scale-[1.02]");
    });

    chip.addEventListener("click", () => {
      targetCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      targetCard.classList.add("bg-surface-container-highest");
      setTimeout(() => {
        targetCard.classList.remove("bg-surface-container-highest");
      }, 800);
    });
  });
});
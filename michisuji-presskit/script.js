(function () {
  const root = document.querySelector("[data-lightbox-root]");
  if (!root) return;

  const image = root.querySelector("[data-lightbox-image]");
  const caption = root.querySelector("[data-lightbox-caption]");
  const closeButton = root.querySelector("[data-lightbox-close]");
  let lastFocus = null;

  function closeLightbox() {
    root.hidden = true;
    image.removeAttribute("src");
    caption.textContent = "";
    document.body.classList.remove("is-lightbox-open");
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest("[data-lightbox]");
    if (!trigger) return;

    event.preventDefault();
    lastFocus = trigger;
    image.src = trigger.href;
    image.alt = trigger.querySelector("img")?.alt || "Screenshot preview";
    caption.textContent = trigger.dataset.caption || "";
    root.hidden = false;
    document.body.classList.add("is-lightbox-open");
    closeButton.focus();
  });

  root.addEventListener("click", function (event) {
    if (event.target === root) closeLightbox();
  });

  closeButton.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", function (event) {
    if (!root.hidden && event.key === "Escape") closeLightbox();
  });
})();

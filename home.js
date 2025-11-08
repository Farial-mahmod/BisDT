let slideIndex = 0;
const slides = document.querySelectorAll('.slide');

function showNextSlide() {
  slides[slideIndex].classList.remove('active');
  slideIndex = (slideIndex + 1) % slides.length;
  slides[slideIndex].classList.add('active');
}

setInterval(showNextSlide, 4000);

// Optional: Toggle menu button behavior
document.getElementById('menu-btn').addEventListener('click', () => {
  alert('Menu button clicked — link to navigation menu here!');
});

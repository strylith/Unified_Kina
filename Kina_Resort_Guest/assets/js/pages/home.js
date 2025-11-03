import { fetchWeatherSummary } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { initPromoBanner } from '../components/promotionalBanner.js';
import { getAuthState } from '../utils/state.js';

export async function HomePage(){
  const tpl = document.getElementById('tpl-home');
  const frag = tpl.content.cloneNode(true);

  // Populate weather
  try{
    const w = await fetchWeatherSummary();
    const root = frag.querySelector('[data-weather-section]');
    if(root){
      root.querySelector('[data-w-temp]').textContent = `${w.current.tempC}°C`;
      root.querySelector('[data-w-cond]').textContent = `${w.current.icon} ${w.current.condition}`;
      root.querySelector('[data-w-loc]').textContent = w.location;
      root.querySelector('[data-w-sugg]').textContent = w.suggestion;
      const future = root.querySelector('[data-w-future]');
      future.innerHTML = w.nextDays.map(d => `
        <div class="chip" aria-label="${d.d} ${d.condition || d.c}">
          <div style="font-weight:600">${d.d}</div>
          <div>${d.t}°C</div>
          <div style="color:var(--color-muted)">${d.condition || d.c || 'Clear'}</div>
        </div>
      `).join('');
    }
  }catch(e){
    showToast('Unable to load weather right now.', 'error');
  }

  // Lazy load feature images and reveal on scroll
  const features = Array.from(frag.querySelectorAll('.feature'));
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      const el = entry.target;
      if(entry.isIntersecting){
        el.classList.add('is-visible');
        const media = el.querySelector('.feature-media');
        const src = el.getAttribute('data-src');
        if(media && src){ media.style.backgroundImage = `url('${src}')`; }
        obs.unobserve(el);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
  features.forEach(el => io.observe(el));

  // Initialize pool section images
  const poolHero = frag.querySelector('.pool-hero');
  if (poolHero) {
    const src = poolHero.getAttribute('data-src');
    if (src) poolHero.style.backgroundImage = `url('${src}')`;
  }

  const poolGalleryItems = Array.from(frag.querySelectorAll('.pool-gallery-item'));
  poolGalleryItems.forEach(item => {
    const src = item.getAttribute('data-src');
    if (src) item.style.backgroundImage = `url('${src}')`;
  });

  const wrapper = document.createElement('div');
  wrapper.appendChild(frag);
  
  // Update buttons based on auth state
  updateHomepageButtons(wrapper);
  
  // Initialize promotional banner after DOM insertion
  setTimeout(() => {
    initPromoBanner();
  }, 100);

  // Initialize pool section scroll animation
  setTimeout(() => {
    initPoolScrollAnimation();
  }, 150);
  
  return wrapper;
}

// Update homepage buttons based on authentication state
function updateHomepageButtons(container) {
  const authState = getAuthState();
  const isLoggedIn = authState.isLoggedIn || false;
  
  // Update all hero slide buttons
  const heroActions = container.querySelectorAll('.promo-hero-actions');
  heroActions.forEach(actionContainer => {
    const primaryBtn = actionContainer.querySelector('.btn.primary.large');
    const hollowBtn = actionContainer.querySelector('.btn.hollow.large');
    
    if (primaryBtn && hollowBtn) {
      if (isLoggedIn) {
        // Logged in: "View Packages" - "View Calendar"
        primaryBtn.textContent = 'View Packages';
        primaryBtn.setAttribute('href', '#/packages');
        hollowBtn.textContent = 'View Calendar';
        hollowBtn.setAttribute('href', '#/weather');
      } else {
        // Not logged in: "Book Now" - "View Packages"
        primaryBtn.textContent = 'Book Now';
        primaryBtn.setAttribute('href', '#/packages');
        hollowBtn.textContent = 'View Packages';
        hollowBtn.setAttribute('href', '#/packages');
      }
    }
  });
  
  // Update bottom CTA section buttons
  const ctaSection = container.querySelector('#section-cta');
  if (ctaSection) {
    const ctaButtons = ctaSection.querySelectorAll('a.btn');
    if (ctaButtons.length >= 2) {
      const primaryCta = ctaButtons[0];
      const hollowCta = ctaButtons[1];
      
      if (isLoggedIn) {
        // Logged in: "View Packages" - "View Calendar"
        primaryCta.textContent = 'View Packages';
        primaryCta.setAttribute('href', '#/packages');
        hollowCta.textContent = 'View Calendar';
        hollowCta.setAttribute('href', '#/weather');
      } else {
        // Not logged in: "Book Now" - "View Packages"
        primaryCta.textContent = 'Book Now';
        primaryCta.setAttribute('href', '#/packages');
        hollowCta.textContent = 'View Packages';
        hollowCta.setAttribute('href', '#/packages');
      }
    }
  }
}

// Export function to update buttons when auth state changes
export function updateHomepageButtonsOnAuthChange() {
  // Only update if we're on the homepage
  const main = document.getElementById('main');
  if (!main) return;
  
  const heroSection = main.querySelector('#section-promo-hero');
  const ctaSection = main.querySelector('#section-cta');
  
  if (heroSection || ctaSection) {
    updateHomepageButtons(main);
  }
}

// Pool section scroll animation - resets on each view like gallery
function initPoolScrollAnimation() {
  const poolSection = document.getElementById('section-pool');
  if (!poolSection) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add visible class when scrolling into view
        entry.target.classList.add('is-visible');
      } else {
        // Remove visible class when scrolling out of view - this resets the animation
        entry.target.classList.remove('is-visible');
      }
    });
  }, {
    threshold: 0.15, // Trigger when 15% of the section is visible
    rootMargin: '0px 0px -50px 0px' // Start slightly before it comes into view
  });

  observer.observe(poolSection);
}



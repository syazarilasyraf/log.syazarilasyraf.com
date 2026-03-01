// animations.js - Smooth animations and micro-interactions

// Fade in element
export function fadeIn(element, duration = 300) {
  element.style.opacity = '0';
  element.style.transition = `opacity ${duration}ms ease`;
  
  requestAnimationFrame(() => {
    element.style.opacity = '1';
  });
}

// Fade out element
export function fadeOut(element, duration = 300) {
  element.style.transition = `opacity ${duration}ms ease`;
  element.style.opacity = '0';
  
  return new Promise(resolve => {
    setTimeout(() => {
      element.style.display = 'none';
      resolve();
    }, duration);
  });
}

// Slide in from bottom
export function slideInUp(element, duration = 300) {
  element.style.transform = 'translateY(20px)';
  element.style.opacity = '0';
  element.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
  
  requestAnimationFrame(() => {
    element.style.transform = 'translateY(0)';
    element.style.opacity = '1';
  });
}

// Scale animation for buttons
export function pulse(element, scale = 1.05) {
  element.style.transition = 'transform 0.15s ease';
  element.style.transform = `scale(${scale})`;
  
  setTimeout(() => {
    element.style.transform = 'scale(1)';
  }, 150);
}

// Shake animation for error
export function shake(element) {
  element.style.animation = 'shake 0.5s ease';
  setTimeout(() => {
    element.style.animation = '';
  }, 500);
}

// Add shake keyframes to document
const shakeStyles = document.createElement('style');
shakeStyles.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0.5; }
    100% { transform: scale(1.3); opacity: 0; }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
`;
document.head.appendChild(shakeStyles);

// Loading spinner
export function createSpinner(size = 24) {
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border: 2px solid var(--border);
    border-top-color: var(--link);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  `;
  return spinner;
}

// Skeleton loading screen
export function createSkeleton(type = 'card') {
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton';
  
  if (type === 'card') {
    skeleton.innerHTML = `
      <div style="padding: 1rem; background: var(--bg-light); border-radius: 12px; margin-bottom: 0.75rem;">
        <div style="height: 20px; background: var(--border); border-radius: 4px; width: 70%; margin-bottom: 0.75rem; animation: pulse 1.5s infinite;"></div>
        <div style="height: 14px; background: var(--border); border-radius: 4px; width: 100%; margin-bottom: 0.5rem; animation: pulse 1.5s infinite 0.1s;"></div>
        <div style="height: 14px; background: var(--border); border-radius: 4px; width: 60%; animation: pulse 1.5s infinite 0.2s;"></div>
      </div>
    `;
  } else if (type === 'text') {
    skeleton.innerHTML = `
      <div style="height: 16px; background: var(--border); border-radius: 4px; width: 100%; margin-bottom: 0.5rem; animation: pulse 1.5s infinite;"></div>
    `;
  }
  
  return skeleton;
}

// Add pulse animation
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
`;
document.head.appendChild(pulseStyle);

// Stagger animation for lists
export function staggerAnimation(elements, delay = 50) {
  elements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, index * delay);
  });
}

// Hover lift effect
export function addHoverLift(element) {
  element.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
  
  element.addEventListener('mouseenter', () => {
    element.style.transform = 'translateY(-2px)';
    element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  });
  
  element.addEventListener('mouseleave', () => {
    element.style.transform = 'translateY(0)';
    element.style.boxShadow = '';
  });
}

// Ripple effect for buttons
export function addRipple(button) {
  button.style.position = 'relative';
  button.style.overflow = 'hidden';
  
  button.addEventListener('click', (e) => {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      pointer-events: none;
      transform: scale(0);
      animation: ripple 0.6s ease-out;
    `;
    
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  });
}

// Add ripple animation
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
  @keyframes ripple {
    to {
      transform: scale(2);
      opacity: 0;
    }
  }
`;
document.head.appendChild(rippleStyle);

// Page transition
export function pageTransition(callback) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg);
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  `;
  document.body.appendChild(overlay);
  
  overlay.style.opacity = '1';
  
  setTimeout(() => {
    callback();
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
  }, 200);
}

// Confetti effect for achievements
export function confetti(element) {
  const colors = ['#2D5A4A', '#4A7C59', '#8ab4f8', '#FF6B6B', '#FFD93D'];
  const rect = element.getBoundingClientRect();
  
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 8px;
      height: 8px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top + rect.height / 2}px;
      pointer-events: none;
      z-index: 9999;
    `;
    
    document.body.appendChild(confetti);
    
    const angle = (Math.PI * 2 * i) / 30;
    const velocity = 100 + Math.random() * 100;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    let x = 0;
    let y = 0;
    let opacity = 1;
    
    const animate = () => {
      x += vx * 0.02;
      y += vy * 0.02 + 2;
      opacity -= 0.02;
      
      confetti.style.transform = `translate(${x}px, ${y}px) rotate(${x * 2}deg)`;
      confetti.style.opacity = opacity;
      
      if (opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        confetti.remove();
      }
    };
    
    requestAnimationFrame(animate);
  }
}

// Initialize all animations on page
export function initAnimations() {
  // Add ripple to all buttons
  document.querySelectorAll('button').forEach(addRipple);
  
  // Add hover lift to cards
  document.querySelectorAll('.conversation-card').forEach(addHoverLift);
  
  // Stagger cards on load
  const cards = document.querySelectorAll('.conversation-card');
  if (cards.length > 0) {
    staggerAnimation(cards, 30);
  }
}

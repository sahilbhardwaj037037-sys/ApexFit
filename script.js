'use strict';

// Phase 1: these actions only show a local notice. No external service is called.
// Future integration points are centralized here and marked in index.html.
const integrationMessages = {
  cal: ['Let’s build your strongest self.', 'Consultation booking is coming soon. Online scheduling is not available yet.'], // TODO: Cal.com
  tally: ['Your next chapter starts here.', 'Coaching applications are coming soon. No application has been submitted.'], // TODO: Tally application
  razorpay: ['Your first step, made simple.', 'Fitness Assessment booking will be available soon. No payment has been taken.'], // TODO: Razorpay ₹499
  whatsapp: ['Let’s keep in touch.', 'WhatsApp chat is coming soon. You’ll be able to connect directly with your coach here.'], // TODO: WhatsApp URL
  social: ['Follow the journey.', 'Our social channels will be available here soon.']
};
const dialog = document.querySelector('#notice-dialog');
const dialogTitle = document.querySelector('#notice-title');
const dialogMessage = document.querySelector('#notice-message');
function showNotice(title, message) {
  dialogTitle.textContent = title;
  dialogMessage.textContent = message;
  dialog.showModal();
}
document.querySelectorAll('[data-integration]').forEach(button => {
  button.addEventListener('click', () => showNotice(...integrationMessages[button.dataset.integration]));
});
document.querySelectorAll('.dialog-close, .dialog-done').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});

const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open navigation');
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) { closeMenu(); toggle.focus(); }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.nav-wrap')) closeMenu();
});
window.matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);

const legalMessages = {
  privacy: ['Privacy Policy', 'Enquiry form submissions are sent to Formspree. A full privacy policy will be provided.'],
  terms: ['Terms', 'Coaching services cannot be purchased or booked through this preview. Service terms will be published before launch. Transformation stories and testimonials are illustrative examples, not verified client accounts.']
};
document.querySelectorAll('[data-legal]').forEach(button => button.addEventListener('click', () => showNotice(...legalMessages[button.dataset.legal])));
document.querySelector('#year').textContent = new Date().getFullYear();

if ('IntersectionObserver' in window) {
  const links = [...navigation.querySelectorAll('a')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) links.forEach(link => {
        const active = link.getAttribute('href') === `#${entry.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
  sections.forEach(section => sectionObserver.observe(section));
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: 0.08 });
    document.querySelectorAll('.program-card, .result-card, .price-card, .testimonial, .steps li').forEach(element => {
      element.classList.add('reveal');
      revealObserver.observe(element);
    });
  }
}

// Temporary n8n test webhook. Attach the handler before enabling the fields.
const newsletterForm = document.querySelector('#newsletter-form');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = newsletterForm.querySelector('fieldset');
    if (fields.disabled) return;
    const status = document.querySelector('#newsletter-status');
    const payload = {
      first_name: document.querySelector('#newsletter-first-name').value.trim(),
      email: document.querySelector('#newsletter-email').value.trim()
    };
    fields.disabled = true;
    status.textContent = 'Submitting…';
    try {
      const response = await fetch('https://bysahilworks.app.n8n.cloud/webhook/apexfit-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Newsletter submission failed');
      status.textContent = 'Thanks! Your sign-up was received.';
    } catch {
      status.textContent = 'We couldn’t submit your sign-up. Please try again.';
    } finally {
      fields.disabled = false;
    }
  });
  newsletterForm.querySelector('fieldset').disabled = false;
}

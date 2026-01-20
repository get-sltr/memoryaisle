// MemoryAisle Website JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', function() {
      this.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuBtn.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });

  // Billing toggle on pricing page
  const billingToggle = document.getElementById('billing-toggle');
  if (billingToggle) {
    const updatePricing = () => {
      const isYearly = billingToggle.checked;
      document.body.classList.toggle('yearly-pricing', isYearly);
      document.body.classList.toggle('monthly-pricing', !isYearly);
    };

    billingToggle.addEventListener('change', updatePricing);
    updatePricing(); // Initialize
  }

  // FAQ accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');

        // Close all other items
        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
          }
        });

        // Toggle current item
        item.classList.toggle('active', !isOpen);
      });
    }
  });

  // Animate elements on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe elements for animation
  document.querySelectorAll('.feature-card, .pricing-card, .mira-content').forEach(el => {
    observer.observe(el);
  });

  // Handle feature cards hover effect
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-8px)';
    });

    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

  // Phone parallax effect on hero
  const heroPhone = document.querySelector('.hero-phone');
  if (heroPhone && window.innerWidth > 768) {
    window.addEventListener('scroll', function() {
      const scrolled = window.scrollY;
      const rate = scrolled * 0.3;
      heroPhone.style.transform = `translateY(${rate}px)`;
    });
  }

  // Scroll indicator click
  const scrollIndicator = document.querySelector('.hero-scroll');
  if (scrollIndicator) {
    scrollIndicator.addEventListener('click', () => {
      const features = document.getElementById('features');
      if (features) {
        features.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Add current year to copyright if needed
  const yearElements = document.querySelectorAll('[data-year]');
  yearElements.forEach(el => {
    el.textContent = new Date().getFullYear();
  });
});

// Prevent flash of unstyled content
document.documentElement.style.visibility = 'visible';

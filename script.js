/**
 * Health Snapshot — Main Application Script
 * BMI analysis, ideal weight range, BMR-based calorie estimation, localStorage
 */

(function () {
  "use strict";

  const BMI_MIN_HEALTHY = 18.5;
  const BMI_MAX_HEALTHY = 24.9;
  const CALORIE_DEFICIT_SURPLUS = 500;

  /** Activity level multipliers (TDEE = BMR × multiplier) */
  const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
  };

  const STORAGE_KEY = "healthSnapshotData";

  /* --------------------------------------------------------------------------
     DOM references
     -------------------------------------------------------------------------- */
  const form = document.getElementById("healthForm");
  const resetBtn = document.getElementById("resetBtn");
  const resultsWrapper = document.getElementById("resultsWrapper");
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  const navbar = document.getElementById("navbar");

  const fields = {
    age: document.getElementById("age"),
    height: document.getElementById("height"),
    weight: document.getElementById("weight"),
    activity: document.getElementById("activity"),
  };

  const errors = {
    age: document.getElementById("ageError"),
    gender: document.getElementById("genderError"),
    height: document.getElementById("heightError"),
    weight: document.getElementById("weightError"),
    activity: document.getElementById("activityError"),
  };

  const bmiCategoryResult = document.getElementById("bmiCategoryResult");
  const idealWeightRange = document.getElementById("idealWeightRange");
  const statusCard = document.getElementById("statusCard");
  const statusIcon = document.getElementById("statusIcon");
  const statusCategory = document.getElementById("statusCategory");
  const statusMessage = document.getElementById("statusMessage");
  const adviceText = document.getElementById("adviceText");
  const maintenanceItem = document.getElementById("maintenanceItem");
  const weightLossItem = document.getElementById("weightLossItem");
  const weightGainItem = document.getElementById("weightGainItem");

  document.getElementById("year").textContent = new Date().getFullYear();

  init();

  function init() {
    setupSmoothScroll();
    setupMobileNav();
    setupNavbarScroll();
    loadFromStorage();
    form.addEventListener("submit", handleSubmit);
    resetBtn.addEventListener("click", handleReset);
    form.addEventListener("input", debounce(saveToStorage, 400));
    form.addEventListener("change", saveToStorage);
  }

  /* --------------------------------------------------------------------------
     BMI calculation & categories
     -------------------------------------------------------------------------- */
  function calculateBMI(weightKg, heightCm) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  }

  function getBMICategory(bmi) {
    if (bmi < BMI_MIN_HEALTHY) return "Underweight";
    if (bmi < 25) return "Normal Weight";
    if (bmi < 30) return "Overweight";
    return "Obese";
  }

  /* --------------------------------------------------------------------------
     Ideal weight range from healthy BMI bounds
     -------------------------------------------------------------------------- */
  function calculateIdealWeightRange(heightCm) {
    const heightM = heightCm / 100;
    const heightMSq = heightM * heightM;
    const minKg = BMI_MIN_HEALTHY * heightMSq;
    const maxKg = BMI_MAX_HEALTHY * heightMSq;
    return {
      min: Math.round(minKg * 10) / 10,
      max: Math.round(maxKg * 10) / 10,
    };
  }

  function formatIdealWeightRange(min, max) {
    return `${min} kg – ${max} kg`;
  }

  /* --------------------------------------------------------------------------
     BMR & daily calorie estimation (Mifflin-St Jeor)
     -------------------------------------------------------------------------- */
  function calculateBMR(age, gender, weightKg, heightCm) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return gender === "male" ? base + 5 : base - 161;
  }

  function calculateMaintenanceCalories(bmr, activityKey) {
    const multiplier = ACTIVITY_MULTIPLIERS[activityKey] || 1.2;
    return Math.round(bmr * multiplier);
  }

  /* --------------------------------------------------------------------------
     BMI-based status card (Blue / Green / Yellow / Red)
     -------------------------------------------------------------------------- */
  function getBMIStatus(bmiCategory) {
    const map = {
      Underweight: {
        level: "blue",
        icon: "↑",
        message:
          "Your BMI is below the healthy range (18.5–24.9). Consider gradual weight gain through nutritious foods.",
      },
      "Normal Weight": {
        level: "green",
        icon: "✓",
        message:
          "Your BMI falls within the healthy range (18.5–24.9). Keep up balanced habits and regular activity.",
      },
      Overweight: {
        level: "yellow",
        icon: "⚠",
        message:
          "Your BMI is above the healthy range (18.5–24.9). Small, sustainable changes can help you move toward normal weight.",
      },
      Obese: {
        level: "red",
        icon: "!",
        message:
          "Your BMI is well above the healthy range (18.5–24.9). Focus on gradual, consistent improvements with professional support if needed.",
      },
    };
    return map[bmiCategory] || map["Normal Weight"];
  }

  /* --------------------------------------------------------------------------
     Show/hide calorie goal rows by BMI category
     Underweight: gain only · Normal: maintenance only · Overweight/Obese: loss only
     -------------------------------------------------------------------------- */
  function updateCalorieGoalVisibility(bmiCategory) {
    const showMaintenance = bmiCategory === "Normal Weight";
    const showWeightLoss =
      bmiCategory === "Overweight" || bmiCategory === "Obese";
    const showWeightGain = bmiCategory === "Underweight";

    maintenanceItem.hidden = !showMaintenance;
    weightLossItem.hidden = !showWeightLoss;
    weightGainItem.hidden = !showWeightGain;
  }

  /* --------------------------------------------------------------------------
     Personalized health advice by BMI category
     -------------------------------------------------------------------------- */
  function getAdvice(bmiCategory) {
    switch (bmiCategory) {
      case "Underweight":
        return "Aim for a healthy calorie surplus with nutrient-dense meals (whole grains, lean protein, healthy fats). Combine this with strength training to build muscle safely toward a normal BMI.";
      case "Normal Weight":
        return "Maintain your current balanced eating habits and regular physical activity. Your BMI is in the healthy range — consistency is key.";
      case "Overweight":
        return "Consider a moderate calorie deficit (around 500 kcal below maintenance) paired with regular exercise such as walking, cycling, or strength training to move toward a normal BMI.";
      case "Obese":
        return "Focus on gradual weight reduction through balanced nutrition, portion control, and daily activity. Small, sustainable changes over time are more effective than extreme restrictions.";
      default:
        return "Use these results as a guide only. Consult a healthcare professional for personalized advice.";
    }
  }

  /* --------------------------------------------------------------------------
     Input validation
     -------------------------------------------------------------------------- */
  function clearErrors() {
    Object.values(errors).forEach((el) => {
      if (el) el.textContent = "";
    });
    [fields.age, fields.height, fields.weight].forEach((input) => {
      input?.classList.remove("invalid");
    });
  }

  function getSelectedGender() {
    const selected = form.querySelector('input[name="gender"]:checked');
    return selected ? selected.value : null;
  }

  function validateForm() {
    clearErrors();
    let valid = true;

    const age = parseFloat(fields.age.value);
    if (!fields.age.value || isNaN(age) || age < 1 || age > 120) {
      errors.age.textContent = "Enter a valid age (1–120).";
      fields.age.classList.add("invalid");
      valid = false;
    }

    const gender = getSelectedGender();
    if (!gender) {
      errors.gender.textContent = "Please select your gender.";
      valid = false;
    }

    const height = parseFloat(fields.height.value);
    if (!fields.height.value || isNaN(height) || height < 50 || height > 250) {
      errors.height.textContent = "Enter height between 50–250 cm.";
      fields.height.classList.add("invalid");
      valid = false;
    }

    const weight = parseFloat(fields.weight.value);
    if (!fields.weight.value || isNaN(weight) || weight < 20 || weight > 300) {
      errors.weight.textContent = "Enter weight between 20–300 kg.";
      fields.weight.classList.add("invalid");
      valid = false;
    }

    if (!fields.activity.value) {
      errors.activity.textContent = "Please select an activity level.";
      valid = false;
    }

    return valid
      ? { age, gender, height, weight, activity: fields.activity.value }
      : null;
  }

  /* --------------------------------------------------------------------------
     Animated counters for numeric results
     -------------------------------------------------------------------------- */
  function animateCounter(element, endValue, decimals, suffix) {
    if (!element) return;
    const duration = 1200;
    const start = performance.now();
    const startVal = 0;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endValue - startVal) * eased;
      const formatted =
        decimals > 0 ? current.toFixed(decimals) : Math.round(current).toString();
      element.textContent = formatted + (suffix || "");
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function animateWeightRange(min, max) {
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentMin = min * eased;
      const currentMax = max * eased;
      idealWeightRange.textContent = formatIdealWeightRange(
        (Math.round(currentMin * 10) / 10).toFixed(1),
        (Math.round(currentMax * 10) / 10).toFixed(1)
      );
      if (progress < 1) requestAnimationFrame(tick);
      else idealWeightRange.textContent = formatIdealWeightRange(min, max);
    }

    requestAnimationFrame(tick);
  }

  /* --------------------------------------------------------------------------
     Display results with reveal animations
     -------------------------------------------------------------------------- */
  function displayResults(data) {
    const {
      bmi,
      bmiCategory,
      idealMin,
      idealMax,
      maintenance,
      weightLoss,
      weightGain,
    } = data;

    resultsWrapper.hidden = false;
    resultsWrapper.scrollIntoView({ behavior: "smooth", block: "start" });

    bmiCategoryResult.textContent = bmiCategory;
    updateCalorieGoalVisibility(bmiCategory);

    const bmiCounter = document.querySelector('[data-counter="bmi"]');
    const maintenanceCounter = document.querySelector('[data-counter="maintenance"]');
    const lossCounter = document.querySelector('[data-counter="weightLoss"]');
    const gainCounter = document.querySelector('[data-counter="weightGain"]');

    animateCounter(bmiCounter, bmi, 1, "");
    animateWeightRange(idealMin, idealMax);

    if (!maintenanceItem.hidden) {
      animateCounter(maintenanceCounter, maintenance, 0, "");
    }
    if (!weightLossItem.hidden) {
      animateCounter(lossCounter, weightLoss, 0, "");
    }
    if (!weightGainItem.hidden) {
      animateCounter(gainCounter, weightGain, 0, "");
    }

    const status = getBMIStatus(bmiCategory);
    statusCard.className = "status-card reveal status-card--" + status.level;
    statusIcon.textContent = status.icon;
    statusCategory.textContent = bmiCategory;
    statusMessage.textContent = status.message;

    adviceText.textContent = getAdvice(bmiCategory);

    requestAnimationFrame(() => {
      resultsWrapper.querySelectorAll(".reveal").forEach((el, i) => {
        el.classList.remove("visible");
        void el.offsetWidth;
        setTimeout(() => el.classList.add("visible"), i * 120);
      });
    });
  }

  /* --------------------------------------------------------------------------
     Form submit & reset
     -------------------------------------------------------------------------- */
  function handleSubmit(e) {
    e.preventDefault();
    const validated = validateForm();
    if (!validated) return;

    const { age, gender, height, weight, activity } = validated;

    const bmi = calculateBMI(weight, height);
    const bmiCategory = getBMICategory(bmi);
    const { min: idealMin, max: idealMax } = calculateIdealWeightRange(height);
    const bmr = calculateBMR(age, gender, weight, height);
    const maintenance = calculateMaintenanceCalories(bmr, activity);
    const weightLoss = Math.max(maintenance - CALORIE_DEFICIT_SURPLUS, 0);
    const weightGain = maintenance + CALORIE_DEFICIT_SURPLUS;

    displayResults({
      bmi: Math.round(bmi * 10) / 10,
      bmiCategory,
      idealMin,
      idealMax,
      maintenance,
      weightLoss,
      weightGain,
    });

    saveToStorage();
  }

  function handleReset() {
    form.reset();
    clearErrors();
    resultsWrapper.hidden = true;
    localStorage.removeItem(STORAGE_KEY);
  }

  /* --------------------------------------------------------------------------
     localStorage — save & restore user data
     -------------------------------------------------------------------------- */
  function getFormData() {
    return {
      age: fields.age.value,
      gender: getSelectedGender(),
      height: fields.height.value,
      weight: fields.weight.value,
      activity: fields.activity.value,
    };
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData()));
    } catch (err) {
      console.warn("Could not save to localStorage:", err);
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.age) fields.age.value = data.age;
      if (data.height) fields.height.value = data.height;
      if (data.weight) fields.weight.value = data.weight;
      if (data.activity) fields.activity.value = data.activity;
      if (data.gender) {
        const radio = form.querySelector(`input[name="gender"][value="${data.gender}"]`);
        if (radio) radio.checked = true;
      }
    } catch (err) {
      console.warn("Could not load from localStorage:", err);
    }
  }

  /* --------------------------------------------------------------------------
     UI helpers
     -------------------------------------------------------------------------- */
  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (e) => {
        const id = anchor.getAttribute("href");
        if (id === "#") return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
        navMenu.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function setupMobileNav() {
    navToggle.addEventListener("click", () => {
      const open = navMenu.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open);
    });
  }

  function setupNavbarScroll() {
    window.addEventListener(
      "scroll",
      () => {
        navbar.classList.toggle("navbar--scrolled", window.scrollY > 20);
      },
      { passive: true }
    );
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }
})();

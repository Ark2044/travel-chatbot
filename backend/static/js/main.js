document.addEventListener("DOMContentLoaded", function () {
  // Initialize Socket.IO with reconnection options
  const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // Socket connection event handlers
  socket.on("connect", () => console.log("Socket connected successfully"));

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
    showToast("Connection lost. Attempting to reconnect...", "error");
  });

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
    showToast(
      "Connection error. Please check your internet connection.",
      "error"
    );
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("Reconnected after", attemptNumber, "attempts");
    showToast("Connection restored!", "success");
  });

  socket.on("reconnect_failed", () => {
    console.error("Failed to reconnect");
    showToast("Failed to reconnect. Please refresh the page.", "error");
  });

  // Get questions data and initialize state
  const questions = JSON.parse(
    document.getElementById("questions-data").textContent
  );
  let currentQuestionIndex = 0;
  let answers = [];
  let isProcessingUserInput = false;

  // Core UI elements
  const chatMessages = document.getElementById("chatMessages");
  const userInput = document.getElementById("userInput");
  const submitAnswer = document.getElementById("submitAnswer");
  const typingIndicator = document.getElementById("typingIndicator");
  const loading = document.getElementById("loading");
  const downloadPdf = document.getElementById("downloadPdf");
  const newTrip = document.getElementById("newTrip");
  const toggleVoice = document.getElementById("toggleVoice");

  // Sidebar elements
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
  const closeSidebar = document.getElementById("closeSidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const conversationList = document.getElementById("conversationList");
  const newConversationBtn = document.getElementById("newConversationBtn");

  // Image panel elements
  const imagesPanel = document.getElementById("imagesPanel");
  const toggleImages = document.getElementById("toggleImages");
  const mobileImageToggle = document.getElementById("mobileImageToggle");
  const closeImagesPanel = document.getElementById("closeImagesPanel");
  const imagesContainer = document.getElementById("imagesContainer");

  // Image viewer elements
  const imageViewer = document.getElementById("imageViewer");
  const fullscreenImage = document.getElementById("fullscreenImage");
  const imageCaption = document.getElementById("imageCaption");
  const closeImageViewer = document.getElementById("closeImageViewer");

  // State variables
  let currentConversationId = null;
  let messageHistory = [];
  let voiceEnabled = true;
  let imagesPanelVisible = window.innerWidth >= 768; // Default visible on desktop
  let sidebarVisible = true;
  let lastTypingTime = 0;
  let isAiTyping = false;
  let isSidebarAnimating = false; // Track if sidebar is in the middle of animation

  // ====== UI INTERACTION HANDLERS ======

  /**
   * Initialize input field state
   */
  function setupInput() {
    // Initial state - disable submit if empty
    submitAnswer.disabled = !userInput.value.trim();

    // Monitor input for changes to toggle button state
    userInput.addEventListener("input", () => {
      submitAnswer.disabled = !userInput.value.trim();
    });

    // Listen for focus to improve mobile experience
    userInput.addEventListener("focus", () => {
      // On mobile, scroll to bottom to ensure input is visible when keyboard appears
      if (window.innerWidth < 768) {
        setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 300);
      }
    });
  }

  /**
   * Add active class to sidebar to improve mobile transitions
   */
  function updateMobileSidebar() {
    if (window.innerWidth < 768) {
      // Make sure we don't have desktop-specific styles on mobile
      sidebar.style.width = "";
      sidebar.style.minWidth = "";
      sidebar.style.opacity = "";

      // Add or remove active class based on visibility state
      if (sidebarVisible) {
        sidebar.classList.add("active");
        sidebarBackdrop.classList.remove("hidden");
        sidebarBackdrop.classList.remove("opacity-0");
        document.body.classList.add("overflow-hidden");
      } else {
        sidebar.classList.remove("active");
        sidebarBackdrop.classList.add("hidden");
        sidebarBackdrop.classList.add("opacity-0");
        document.body.classList.remove("overflow-hidden");
      }
    }
  }

  /**
   * Mobile sidebar toggle handler with improved animation
   */
  function toggleMobileSidebar() {
    // If animation is in progress, don't allow another toggle
    if (isSidebarAnimating) return;

    isSidebarAnimating = true;
    sidebarVisible = !sidebarVisible;

    // Use the active class for better transitions
    if (sidebarVisible) {
      // Show sidebar
      sidebar.classList.add("active");
      sidebar.classList.remove("-translate-x-full");
      sidebarBackdrop.classList.remove("hidden");

      // Force a reflow
      sidebarBackdrop.offsetHeight;

      sidebarBackdrop.classList.remove("opacity-0");
      document.body.classList.add("overflow-hidden");
    } else {
      // Hide sidebar
      sidebar.classList.remove("active");
      sidebar.classList.add("-translate-x-full");
      sidebarBackdrop.classList.add("opacity-0");

      setTimeout(() => {
        if (!sidebarVisible) {
          sidebarBackdrop.classList.add("hidden");
          document.body.classList.remove("overflow-hidden");
        }
      }, 300);
    }

    // Reset animation state after transition
    setTimeout(() => {
      isSidebarAnimating = false;
    }, 300);
  }

  /**
   * Desktop sidebar toggle handler
   */
  function toggleDesktopSidebar() {
    sidebarVisible = !sidebarVisible;

    if (sidebarVisible) {
      // Show sidebar
      sidebar.classList.remove("md:w-0");
      sidebar.classList.add("md:w-72");
      sidebar.style.width = "18rem"; // 72px in rem
      sidebar.style.minWidth = "18rem";
      sidebar.style.opacity = "1";
    } else {
      // Hide sidebar
      sidebar.classList.add("md:w-0");
      sidebar.classList.remove("md:w-72");
      sidebar.style.width = "0";
      sidebar.style.minWidth = "0";
      sidebar.style.opacity = "0";
    }
  }

  /**
   * Mobile-friendly image panel toggle with improved reliability
   */
  function toggleImagePanel() {
    imagesPanelVisible = !imagesPanelVisible;

    if (window.innerWidth < 768) {
      // Mobile implementation with better touch handling
      if (imagesPanelVisible) {
        // Reset any previous styles first
        imagesPanel.style.transform = "";
        imagesPanel.style.transition = "";

        // Apply proper classes
        imagesPanel.classList.remove("hidden");
        imagesPanel.classList.add("fixed", "inset-0", "z-40");
        document.body.classList.add("overflow-hidden");

        // Force a reflow before adding animation
        imagesPanel.offsetHeight;

        // Add animation
        imagesPanel.classList.add("animate-slideInRight");

        // Remove animation class after it completes
        setTimeout(() => {
          imagesPanel.classList.remove("animate-slideInRight");
        }, 300);
      } else {
        // Add transition for smooth exit
        imagesPanel.style.transition = "transform 0.3s ease-out";
        imagesPanel.style.transform = "translateX(100%)";

        // Clean up after animation finishes
        setTimeout(() => {
          imagesPanel.classList.add("hidden");
          imagesPanel.classList.remove("fixed", "inset-0", "z-40");
          imagesPanel.style.transform = "";
          imagesPanel.style.transition = "";
          document.body.classList.remove("overflow-hidden");
        }, 300);
      }
    } else {
      // Desktop implementation (unchanged)
      imagesPanel.classList.toggle("hidden");
      imagesPanel.classList.toggle("md:flex");

      if (!imagesPanel.classList.contains("hidden")) {
        imagesPanel.classList.add("animate-slideInRight");
        setTimeout(
          () => imagesPanel.classList.remove("animate-slideInRight"),
          300
        );
      }
    }
  }

  /**
   * Open image in fullscreen viewer
   */
  function openImageViewer(src, alt, caption) {
    fullscreenImage.src = src;
    fullscreenImage.alt = alt || "Travel destination image";
    imageCaption.textContent = caption || "";
    imageViewer.classList.remove("hidden");
    imageViewer.classList.add("animate-fadeIn");
    document.body.classList.add("overflow-hidden");
  }

  /**
   * Close the image fullscreen viewer
   */
  function closeImageViewerHandler() {
    imageViewer.classList.add("opacity-0");
    setTimeout(() => {
      imageViewer.classList.add("hidden");
      imageViewer.classList.remove("opacity-0");
      fullscreenImage.src = "";
      document.body.classList.remove("overflow-hidden");
    }, 300);
  }

  /**
   * Show/hide typing indicator controls
   */
  function showTypingIndicator() {
    isAiTyping = true;
    typingIndicator.classList.remove("hidden");
  }

  function hideTypingIndicator() {
    isAiTyping = false;
    typingIndicator.classList.add("hidden");
  }

  // ====== BIND EVENT LISTENERS ======

  // Set up input field behaviors
  setupInput();

  // Mobile UI handlers
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener("click", toggleMobileSidebar);
  }

  if (closeSidebar) {
    closeSidebar.addEventListener("click", toggleMobileSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", toggleMobileSidebar);
  }

  // Desktop UI handlers
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleDesktopSidebar);
  }

  // Image panel handlers
  if (toggleImages) {
    toggleImages.addEventListener("click", toggleImagePanel);
  }

  if (mobileImageToggle) {
    mobileImageToggle.addEventListener("click", toggleImagePanel);
  }

  if (closeImagesPanel) {
    closeImagesPanel.addEventListener("click", toggleImagePanel);
  }

  // Image viewer handlers
  if (closeImageViewer) {
    closeImageViewer.addEventListener("click", closeImageViewerHandler);
  }

  if (imageViewer) {
    imageViewer.addEventListener("click", (e) => {
      if (e.target === imageViewer) closeImageViewerHandler();
    });
  }

  // New conversation button
  if (newConversationBtn) {
    newConversationBtn.addEventListener("click", () => {
      newTrip.click(); // Use existing function

      // On mobile, close the sidebar after starting a new conversation
      if (window.innerWidth < 768) toggleMobileSidebar();
    });
  }

  // ESC key handling for modals and panels
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Close image viewer if open
      if (!imageViewer.classList.contains("hidden")) {
        closeImageViewerHandler();
        return;
      }

      // Close mobile sidebar if open
      if (
        window.innerWidth < 768 &&
        !sidebar.classList.contains("-translate-x-full") &&
        sidebarVisible
      ) {
        toggleMobileSidebar();
        return;
      }

      // Close mobile image panel if open
      if (window.innerWidth < 768 && imagesPanelVisible) {
        toggleImagePanel();
        return;
      }
    }
  });

  // Make buttons more responsive on touch devices
  document.querySelectorAll("button").forEach((button) => {
    // Prevent ghost clicks
    button.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        this.click();
      },
      { passive: false }
    );
  });

  // ====== CORE FUNCTIONALITY ======

  /**
   * Helper function to determine if a query is relevant for image search
   */
  function isRelevantQuery(query) {
    // Only show images for the first question (destination selection)
    if (currentQuestionIndex !== 0) return false;

    // Skip queries that are numbers or contain currency
    if (/^\d+$/.test(query.replace(/[$,]/g, "").trim())) return false;

    // Skip greetings or common words
    const skipWords = ["hi", "hello", "hey", "yes", "no", "ok", "okay"];
    if (skipWords.includes(query.toLowerCase())) return false;

    // For the destination question, any non-skipped input is relevant
    return true;
  }

  /**
   * Search for destination images and display them
   */
  async function searchAndDisplayImages(query) {
    try {
      // Only search for images if the query seems relevant
      if (!isRelevantQuery(query)) return;

      // Show loading state in the images panel
      imagesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-center text-gray-500">
                    <div class="w-10 h-10 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin mb-4"></div>
                    <p>Searching for images of ${escapeHtml(query)}...</p>
                </div>
            `;

      // Make image panel visible if it's hidden
      if (!imagesPanelVisible) toggleImagePanel();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch("/search-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            destination: query, // For the first question, the query is the destination
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Server responded with ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();
        if (data.images && data.images.length > 0) {
          // Clear placeholder content
          imagesContainer.innerHTML = "";

          // Create a new image set
          const imageSet = document.createElement("div");
          imageSet.className = "mb-8";

          // Add title showing the destination
          const title = document.createElement("h3");
          title.className =
            "text-lg font-medium text-primary-600 mb-4 pb-2 border-b border-gray-200 flex items-center";
          title.innerHTML = `Places in ${escapeHtml(query)}`;
          imageSet.appendChild(title);

          // Create image grid
          const imageGrid = document.createElement("div");
          imageGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";

          data.images.forEach((image) => {
            const imageItem = document.createElement("div");
            imageItem.className =
              "group relative rounded-xl overflow-hidden shadow-md cursor-pointer aspect-video bg-gray-100 hover:shadow-lg transition-shadow";

            const img = document.createElement("img");
            img.src = image.url;
            img.alt = image.alt || "Travel destination image";
            img.loading = "lazy";
            img.className =
              "absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105";

            // Add error handling for images
            img.onerror = () => {
              img.src =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cline x1='16.5' y1='7.5' x2='16.5' y2='7.5'/%3E%3Cline x1='3' y1='15' x2='8' y2='10'/%3E%3C/svg%3E";
              img.className = img.className.replace(
                "group-hover:scale-105",
                ""
              );
            };

            const credit = document.createElement("div");
            credit.className =
              "absolute inset-x-0 bottom-0 bg-black bg-opacity-70 text-white py-2 px-3 text-sm transform transition-transform duration-300 translate-y-full group-hover:translate-y-0";
            credit.textContent = `Photo by ${image.credit || "Unknown"}`;

            imageItem.appendChild(img);
            imageItem.appendChild(credit);
            imageGrid.appendChild(imageItem);

            // Make images clickable to view full size
            imageItem.addEventListener("click", () => {
              openImageViewer(
                image.url,
                image.alt,
                `Photo by ${image.credit || "Unknown"}`
              );
            });
          });

          imageSet.appendChild(imageGrid);
          imagesContainer.appendChild(imageSet);

          // Scroll to the top of the images container
          imagesContainer.scrollTop = 0;
        } else {
          // Show no results message
          imagesContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-center text-gray-500">
                <svg class="w-16 h-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <p>No images found for "${escapeHtml(query)}"</p>
                <p class="text-sm mt-2">Try a more specific location name</p>
            </div>
          `;
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error("Fetch error:", fetchError);

        if (fetchError.name === "AbortError") {
          showToast("Image search timed out. Please try again later.", "error");
        } else {
          showToast("Error fetching images. Please try again.", "error");
        }

        // Show error in the images panel
        imagesContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center h-64 text-center text-gray-500">
              <svg class="w-16 h-16 text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <p>Error loading images</p>
              <p class="text-sm mt-2">Please try again later</p>
          </div>
        `;
      }
    } catch (error) {
      console.error("Error in searchAndDisplayImages:", error);
      // Show error message
      imagesContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-center text-gray-500">
            <svg class="w-16 h-16 text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <p>Error loading images</p>
            <p class="text-sm mt-2">Please try again later</p>
        </div>
      `;
    }
  }

  /**
   * Performance optimization for chat messages rendering
   * Uses a document fragment to batch DOM operations
   */
  function addMessage(content, isUser = false, isError = false) {
    // Create a document fragment to batch DOM operations
    const fragment = document.createDocumentFragment();

    const messageWrapper = document.createElement("div");
    messageWrapper.className = `flex ${
      isUser ? "justify-end" : "justify-start"
    } max-w-3xl mx-auto w-full animate-fadeInUp`;

    const messageDiv = document.createElement("div");

    if (isUser) {
      messageDiv.className =
        "bg-white rounded-2xl rounded-tr-sm py-3 px-4 shadow-sm max-w-[85%]";
    } else if (isError) {
      messageDiv.className =
        "bg-red-50 text-error border-l-4 border-error rounded-2xl py-3 px-4 shadow-sm max-w-[85%]";
    } else {
      messageDiv.className =
        "bg-white border border-gray-200 rounded-2xl rounded-tl-sm py-3 px-4 shadow-sm max-w-[85%]";
    }

    messageDiv.innerHTML = formatMessage(content);
    messageWrapper.appendChild(messageDiv);
    fragment.appendChild(messageWrapper);

    // Single DOM update
    chatMessages.appendChild(fragment);

    // If it's a user message, search for images
    if (isUser) {
      searchAndDisplayImages(content);
    }

    // Scroll to the bottom of chat
    scrollToBottom();

    // Add to message history
    messageHistory.push({
      content: content,
      is_user: isUser,
    });
  }

  /**
   * Format a message for display, adding links and properly handling markdown
   */
  function formatMessage(content) {
    if (!content) return "";

    // First escape the content to prevent XSS
    content = escapeHtml(content);

    // Convert URLs to links (safe since we've already escaped HTML)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    content = content.replace(
      urlRegex,
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-700">${url}</a>`
    );

    // Handle markdown-style formatting

    // Bold: **text** or __text__
    content = content.replace(
      /\*\*(.*?)\*\*|__(.*?)__/g,
      (match, g1, g2) =>
        `<strong class="font-semibold text-primary-800">${g1 || g2}</strong>`
    );

    // Italic: *text* or _text_
    content = content.replace(
      /\*(.*?)\*|_(.*?)_/,
      (match, g1, g2) => `<em class="italic">${g1 || g2}</em>`
    );

    // Headers: # Header, ## Header, ### Header
    content = content.replace(
      /^# (.*?)$/gm,
      (match, text) =>
        `<h1 class="text-2xl font-bold mb-3 text-primary-700 font-display">${text}</h1>`
    );
    content = content.replace(
      /^## (.*?)$/gm,
      (match, text) =>
        `<h2 class="text-xl font-bold mb-2 text-primary-700 font-display">${text}</h2>`
    );
    content = content.replace(
      /^### (.*?)$/gm,
      (match, text) =>
        `<h3 class="text-lg font-bold mb-2 text-primary-600 font-display">${text}</h3>`
    );

    // Lists: - item or * item
    content = content.replace(
      /^[*-] (.*?)$/gm,
      (match, text) =>
        `<div class="flex items-start mb-1.5"><span class="inline-block w-4 text-primary-500">•</span> <span>${text}</span></div>`
    );

    // Convert newlines to <br> after handling markdown formatting
    content = content.replace(/\n/g, "<br>");

    // Make important travel sections bold and colorful
    const sectionRegex =
      /\b(Day \d+|TRAVEL METHOD|ACCOMMODATION|DAY-BY-DAY ITINERARY|DINING RECOMMENDATIONS|LOCAL EXPERIENCES)\b/g;
    content = content.replace(
      sectionRegex,
      (match) =>
        `<strong class="font-semibold text-primary-700">${match}</strong>`
    );

    return content;
  }

  /**
   * Smooth scroll to the bottom of the chat
   */
  function scrollToBottom() {
    chatMessages.scrollTo({
      top: chatMessages.scrollHeight,
      behavior: "smooth",
    });
  }

  /**
   * Validate user answer with server
   */
  async function validateAnswer(answer) {
    try {
      const response = await fetch("/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: currentQuestionIndex,
          answer: answer,
        }),
      });
      return await response.json();
    } catch (error) {
      console.error("Validation error:", error);
      return { valid: true, message: "" };
    }
  }

  /**
   * Show typing indicator in chat
   */
  function showChatTypingIndicator() {
    const wrapper = document.createElement("div");
    wrapper.className =
      "flex justify-start max-w-3xl mx-auto w-full animate-fadeIn typing-indicator-container";

    const typingDiv = document.createElement("div");
    typingDiv.className =
      "bg-white border border-gray-200 rounded-2xl rounded-tl-sm py-3 px-4 shadow-sm";
    typingDiv.innerHTML =
      '<div class="flex items-center gap-1.5"><span class="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style="animation-delay: -0.16s"></span><span class="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style="animation-delay: -0.32s"></span></div>';

    wrapper.appendChild(typingDiv);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  /**
   * Remove typing indicator from chat
   */
  function removeChatTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
      // Fade out animation
      indicator.classList.add("opacity-0");
      setTimeout(() => {
        indicator.parentNode.removeChild(indicator);
      }, 300);
    }
  }

  /**
   * Display the next question in the sequence
   */
  async function showNextQuestion() {
    if (currentQuestionIndex < questions.length) {
      showTypingIndicator();
      const typingIndicator = showChatTypingIndicator();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      removeChatTypingIndicator(typingIndicator);
      hideTypingIndicator();

      addMessage(questions[currentQuestionIndex]);
      userInput.value = "";
      userInput.focus();
      submitAnswer.disabled = true;
    } else {
      loading.classList.remove("hidden");
      generateItinerary();
    }
  }

  /**
   * Submit user answer and process it
   */
  async function submitUserAnswer() {
    if (isProcessingUserInput) return;

    const answer = userInput.value.trim();
    if (!answer) return;

    isProcessingUserInput = true;
    submitAnswer.disabled = true;

    try {
      const validation = await validateAnswer(answer);
      if (!validation.valid) {
        addMessage(answer, true);
        addMessage(validation.message, false, true);
        userInput.value = "";
        userInput.focus();
        submitAnswer.disabled = true;
        isProcessingUserInput = false;
        return;
      }

      answers.push(answer);
      addMessage(answer, true);
      currentQuestionIndex++;

      // Wait a moment before showing next question
      setTimeout(() => {
        showNextQuestion();
        isProcessingUserInput = false;
      }, 500);
    } catch (error) {
      console.error("Error processing answer:", error);
      addMessage(
        "Sorry, there was an error processing your answer. Please try again.",
        false,
        true
      );
      isProcessingUserInput = false;
      submitAnswer.disabled = false;
    }
  }

  // Bind input event handlers
  submitAnswer.addEventListener("click", submitUserAnswer);

  userInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !submitAnswer.disabled) {
      e.preventDefault();
      submitUserAnswer();
    }
  });

  /**
   * Generate the travel itinerary
   */
  function generateItinerary() {
    showTypingIndicator();
    const typingIndicator = showChatTypingIndicator();

    const requestTimeout = setTimeout(() => {
      removeChatTypingIndicator(typingIndicator);
      addMessage(
        "The request is taking longer than expected. Please try again.",
        false,
        true
      );
      loading.classList.add("hidden");
      hideTypingIndicator();
    }, 120000);

    // Create a controller for aborting the fetch request if needed
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 130000); // 130 second timeout

    fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: answers.map((a) => String(a)), // Ensure all answers are strings
        messages: messageHistory,
      }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Server responded with ${response.status}: ${response.statusText}`
          );
        }
        return response.json();
      })
      .then((data) => {
        clearTimeout(requestTimeout);
        clearTimeout(abortTimeout);
        removeChatTypingIndicator(typingIndicator);
        hideTypingIndicator();

        if (data.status === "success") {
          loading.classList.add("hidden");

          // Show action buttons with animation
          downloadPdf.classList.remove("hidden");
          downloadPdf.classList.add("flex", "animate-fadeInUp");
          newTrip.classList.remove("hidden");
          newTrip.classList.add("flex", "animate-fadeInUp");

          downloadPdf.onclick = () => {
            // Sanitize the PDF filename
            const safeFilename = data.pdf_file
              ? data.pdf_file.replace(/[^a-zA-Z0-9_\-.]/g, "")
              : "itinerary.pdf";

            window.location.href = `/download/${safeFilename}`;

            // Show success toast
            showToast("Your itinerary PDF is downloading!", "success");
          };

          loadConversations();
          currentConversationId = data.conversation_id;

          // Scroll to bottom to ensure buttons are visible
          scrollToBottom();
        } else {
          addMessage(
            data.message ||
              "Sorry, there was an error generating your itinerary. Please try again.",
            false,
            true
          );
          loading.classList.add("hidden");
        }
      })
      .catch((error) => {
        clearTimeout(requestTimeout);
        clearTimeout(abortTimeout);
        removeChatTypingIndicator(typingIndicator);
        hideTypingIndicator();

        console.error("Error:", error);

        let errorMessage =
          "Sorry, there was an error generating your itinerary. Please try again.";
        if (error.name === "AbortError") {
          errorMessage =
            "The request was taking too long and was cancelled. Please try again later.";
        }

        addMessage(errorMessage, false, true);
        loading.classList.add("hidden");
      });
  }

  /**
   * Handle response chunks from the server
   */
  socket.on("response_chunk", function (data) {
    if (!isAiTyping) {
      showTypingIndicator();
    }

    // Reset the typing indicator timeout
    lastTypingTime = Date.now();

    const lastMessage = Array.from(chatMessages.children)
      .filter((el) => !el.querySelector('[class*="animate-bounce"]'))
      .pop();
    const typingIndicatorElement = document.querySelector(
      ".typing-indicator-container"
    );

    if (
      lastMessage &&
      lastMessage.classList.contains("justify-start") &&
      !lastMessage.querySelector('[class*="animate-bounce"]')
    ) {
      const messageContent = lastMessage.querySelector("div");
      if (data.chunk === "...") {
        if (!messageContent.innerHTML.endsWith("...")) {
          messageContent.innerHTML += "...";
        }
      } else {
        // Remove trailing ellipsis if present
        if (messageContent.innerHTML.endsWith("...")) {
          messageContent.innerHTML = messageContent.innerHTML.slice(0, -3);
        }
        messageContent.innerHTML += formatMessage(data.chunk);
      }
    } else {
      // Remove typing indicator if it exists
      if (typingIndicatorElement) {
        removeChatTypingIndicator(typingIndicatorElement);
      }

      // Add first chunk
      if (data.chunk) {
        addMessage(data.chunk);
      }
    }

    scrollToBottom();

    // If no new chunks after 3 seconds, hide typing indicator
    setTimeout(() => {
      if (Date.now() - lastTypingTime > 2900) {
        hideTypingIndicator();
      }
    }, 3000);
  });

  /**
   * Load conversation history
   */
  async function loadConversations() {
    try {
      const response = await fetch("/conversations");
      const conversations = await response.json();

      if (conversations.length === 0) {
        conversationList.innerHTML = `
          <div class="text-center text-gray-500 py-8">
            <svg class="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 00-2-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
            <p>Your past conversations will appear here</p>
          </div>
        `;
        return;
      }

      conversationList.innerHTML = "";

      conversations.forEach((conv) => {
        const item = document.createElement("div");
        item.className = `bg-white rounded-lg shadow-sm border border-gray-200 hover:border-primary-300 p-3 cursor-pointer transition-all ${
          currentConversationId === conv.id
            ? "border-l-4 border-l-primary-600"
            : ""
        }`;
        item.dataset.conversationId = conv.id;

        const formattedDate = new Date(conv.created_at).toLocaleDateString(
          undefined,
          {
            year: "numeric",
            month: "short",
            day: "numeric",
          }
        );

        item.innerHTML = `
          <div class="flex justify-between items-start">
            <h4 class="font-medium text-primary-700 truncate">${escapeHtml(
              conv.destination
            )}</h4>
            <span class="text-xs text-gray-500">${formattedDate}</span>
          </div>
          <p class="text-sm text-gray-600 mt-1 line-clamp-2">${escapeHtml(
            truncateText(conv.preview, 100)
          )}</p>
        `;

        item.addEventListener("click", () => loadConversation(conv.id));
        conversationList.appendChild(item);
      });
    } catch (error) {
      console.error("Error loading conversations:", error);
      showToast("Error loading conversation history", "error");
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Truncate text to specified length
   */
  function truncateText(text, maxLength) {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  /**
   * Load a specific conversation
   */
  async function loadConversation(conversationId) {
    try {
      // Show loading state
      chatMessages.innerHTML = `
        <div class="flex justify-center items-center h-64 w-full">
          <div class="flex flex-col items-center">
            <div class="w-10 h-10 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin mb-4"></div>
            <p class="text-gray-500">Loading conversation...</p>
          </div>
        </div>
      `;

      const response = await fetch(`/conversation/${conversationId}`);
      const conversation = await response.json();

      // Clear chat
      chatMessages.innerHTML = "";

      // Add conversation messages
      conversation.messages.forEach((msg) => {
        addMessage(msg.content, msg.is_user);
      });

      // Update selected conversation
      document.querySelectorAll("[data-conversation-id]").forEach((item) => {
        if (item.dataset.conversationId === conversationId.toString()) {
          item.classList.add("border-l-4", "border-l-primary-600");
        } else {
          item.classList.remove("border-l-4", "border-l-primary-600");
        }
      });

      currentConversationId = conversationId;

      // Show action buttons
      downloadPdf.classList.remove("hidden");
      downloadPdf.classList.add("flex");
      newTrip.classList.remove("hidden");
      newTrip.classList.add("flex");

      // On mobile, close the sidebar after selection
      if (window.innerWidth < 768) {
        toggleMobileSidebar();
      }

      // Update input field state for loaded conversation
      userInput.disabled = true;
      userInput.placeholder =
        "This is a past conversation. Start a new trip to chat again.";
      submitAnswer.disabled = true;
    } catch (error) {
      console.error("Error loading conversation:", error);
      showToast("Error loading conversation", "error");
      chatMessages.innerHTML = `
        <div class="flex justify-center items-center h-64 w-full">
          <div class="flex flex-col items-center text-center">
            <svg class="w-16 h-16 text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <p class="text-gray-700">Error loading conversation</p>
            <p class="text-sm text-gray-500 mt-2">Please try again later or start a new trip</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * Start a new trip conversation
   */
  function startNewTrip() {
    currentConversationId = null;
    messageHistory = [];
    currentQuestionIndex = 0;
    answers = [];

    // Reset chat with welcome message
    chatMessages.innerHTML = `
      <div class="flex animate-fadeInUp max-w-3xl mx-auto">
        <div class="bg-white rounded-2xl shadow-soft p-5 border border-gray-200">
          <div class="flex items-center mb-4">
            <div class="w-10 h-10 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mr-3">
              <span class="text-xl">🌍</span>
            </div>
            <div>
              <h3 class="font-semibold text-primary-700">Travel Planner AI</h3>
              <p class="text-xs text-gray-500">Ready to help you plan your perfect trip</p>
            </div>
          </div>
          <p class="mb-3">👋 Hi! I'm your AI Travel Planner. I'll help you create a personalized travel itinerary.</p>
          <p>Let's start planning your perfect trip!</p>
        </div>
      </div>
    `;

    // Hide action buttons
    downloadPdf.classList.add("hidden");
    downloadPdf.classList.remove("flex");
    newTrip.classList.add("hidden");
    newTrip.classList.remove("flex");

    // Remove selected state from conversations
    document.querySelectorAll("[data-conversation-id]").forEach((item) => {
      item.classList.remove("border-l-4", "border-l-primary-600");
    });

    // Enable input field for new conversation
    userInput.disabled = false;
    userInput.placeholder = "Type your message here...";

    // Clear images
    imagesContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center text-gray-500">
        <svg class="w-16 h-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <p>Images will appear here when you mention a destination</p>
      </div>
    `;

    // Start new conversation
    showNextQuestion();

    // Show toast notification
    showToast("Started a new trip conversation", "info");
  }

  // Bind new trip button
  newTrip.addEventListener("click", startNewTrip);

  /**
   * Toggle voice feature on/off
   */
  toggleVoice.addEventListener("click", async function () {
    voiceEnabled = !voiceEnabled;
    toggleVoice.classList.toggle("text-accent", voiceEnabled);

    // Add visual feedback for toggle state
    if (voiceEnabled) {
      toggleVoice.classList.add("bg-primary-50");
      toggleVoice.setAttribute("aria-label", "Disable voice");
      toggleVoice.setAttribute("title", "Disable voice");
    } else {
      toggleVoice.classList.remove("bg-primary-50");
      toggleVoice.setAttribute("aria-label", "Enable voice");
      toggleVoice.setAttribute("title", "Enable voice");
    }

    try {
      const response = await fetch("/toggle-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: voiceEnabled }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();

      // Show feedback toast
      const feedbackMessage = voiceEnabled ? "Voice enabled" : "Voice disabled";
      showToast(feedbackMessage, voiceEnabled ? "success" : "info");
    } catch (error) {
      console.error("Error toggling voice:", error);
      showToast("Error toggling voice", "error");

      // Revert to previous state on error
      voiceEnabled = !voiceEnabled;
      toggleVoice.classList.toggle("text-accent", voiceEnabled);
      toggleVoice.classList.toggle("bg-primary-50", voiceEnabled);
    }
  });

  /**
   * Show a toast notification
   */
  function showToast(message, type = "info") {
    // Remove any existing toasts first
    document
      .querySelectorAll(".toast-notification")
      .forEach((toast) => toast.remove());

    const toast = document.createElement("div");

    let bgColor = "bg-primary-50 border-primary-200 text-primary-700"; // info
    let icon = `<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`;

    if (type === "success") {
      bgColor = "bg-green-50 border-green-200 text-green-700";
      icon = `<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>`;
    }

    if (type === "error") {
      bgColor = "bg-red-50 border-red-200 text-red-700";
      icon = `<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>`;
    }

    toast.className = `fixed top-6 right-6 z-50 px-4 py-3 rounded-lg border flex items-center ${bgColor} shadow-md transform transition-all duration-500 opacity-0 translate-y-[-1rem] toast-notification`;
    toast.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.replace("opacity-0", "opacity-100");
      toast.classList.replace("translate-y-[-1rem]", "translate-y-0");
    }, 10);

    // Animate out
    setTimeout(() => {
      toast.classList.replace("opacity-100", "opacity-0");
      toast.classList.replace("translate-y-0", "translate-y-[-1rem]");
      setTimeout(() => toast.remove(), 500);
    }, 5000);

    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.className =
      "ml-3 p-1 hover:bg-black hover:bg-opacity-10 rounded-full transition-colors";
    closeBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>`;
    closeBtn.addEventListener("click", () => {
      toast.classList.replace("opacity-100", "opacity-0");
      toast.classList.replace("translate-y-0", "translate-y-[-1rem]");
      setTimeout(() => toast.remove(), 500);
    });
    toast.appendChild(closeBtn);
  }

  // Improved window resize handler for smoother transitions
  window.addEventListener("resize", function () {
    const wasMobile = window.innerWidth < 768;
    const isMobile = window.innerWidth < 768;

    // Only trigger transition logic if we're crossing the mobile/desktop threshold
    if (wasMobile !== isMobile) {
      if (!isMobile) {
        // Switching to desktop
        // Reset mobile-specific styles
        sidebar.classList.remove(
          "fixed",
          "inset-y-0",
          "left-0",
          "transform",
          "-translate-x-full",
          "active"
        );
        sidebar.classList.add("md:translate-x-0", "md:static");
        sidebarBackdrop.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");

        // Set desktop sidebar visibility
        if (sidebarVisible) {
          sidebar.classList.remove("md:w-0");
          sidebar.classList.add("md:w-72");
          sidebar.style.width = "18rem";
          sidebar.style.minWidth = "18rem";
          sidebar.style.opacity = "1";
        } else {
          sidebar.classList.add("md:w-0");
          sidebar.classList.remove("md:w-72");
          sidebar.style.width = "0";
          sidebar.style.minWidth = "0";
          sidebar.style.opacity = "0";
        }

        // Reset image panel for desktop
        imagesPanel.classList.remove("fixed", "inset-0", "z-40");
        imagesPanel.style.transform = "";
        imagesPanel.style.transition = "";

        if (imagesPanelVisible) {
          imagesPanel.classList.remove("hidden");
          imagesPanel.classList.add("md:flex");
        } else {
          imagesPanel.classList.add("hidden");
          imagesPanel.classList.remove("md:flex");
        }
      } else {
        // Switching to mobile
        // Add mobile classes and states
        sidebar.classList.add("fixed", "inset-y-0", "left-0", "transform");

        // Reset desktop-specific styles
        sidebar.style.width = "";
        sidebar.style.minWidth = "";
        sidebar.style.opacity = "";

        // Update sidebar visibility for mobile
        updateMobileSidebar();

        // Set up image panel for mobile
        imagesPanel.classList.add("hidden");
        imagesPanel.classList.remove("md:flex");
      }
    }
  });

  // Fix buttons on iOS
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    // Add better touch handling for iOS devices
    document
      .querySelectorAll(
        "#actionButtons button, #mobileImageToggle, #mobileSidebarToggle"
      )
      .forEach((btn) => {
        btn.addEventListener("touchend", function (e) {
          e.preventDefault();
          // Add visual feedback
          this.style.opacity = "0.7";
          setTimeout(() => (this.style.opacity = "1"), 150);
        });
      });
  }

  // Handle online/offline status
  window.addEventListener("online", function () {
    showToast("You're back online!", "success");
    if (!socket.connected) socket.connect();
  });

  window.addEventListener("offline", function () {
    showToast("You're offline. Some features may be unavailable.", "error");
  });

  // Check connection status on page load
  if (!navigator.onLine) {
    showToast(
      "You appear to be offline. Some features may be unavailable.",
      "error"
    );
  }

  // Initialize UI
  loadConversations();
  showNextQuestion();

  // Focus the input field on page load
  setTimeout(() => userInput.focus(), 500);
});

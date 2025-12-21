class QuizSolver {
  static apiUrl = 'https://k-quiz-solver-api.onrender.com'
  // static apiUrl = 'http://localhost:8000';

  static isChromeRuntimeAvailable() {
    try {
      return !!(
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.id
      );
    } catch (error) {
      return false;
    }
  }

  constructor() {
    this.ansArray = [-1, -1, -1, -1, -1]
    this.ansData = [null, null, null, null, null]
    this.currentQuestion = 0
    this.G_API_KEY = localStorage.getItem('G_API_KEY') || ''
    this.C_API_KEY = localStorage.getItem('C_API_KEY') || ''
    this.X_API_KEY = localStorage.getItem('X_API_KEY') || ''
    this.delay = 30
    this.autoStart = '0'
    this.bypassEnabled = '1'
    this.AI_MODEL = localStorage.getItem('AI_MODEL') || 'gemini-2.5-flash'
    this.modal = null
    this.modalContent
    this.toggleModalBtn
    this.closeModelBtn
    this.quizData = null;
    this.serverWakeUpTimeStamp = 0;
    this.syncKeysFromChromeStorage();
  }

  async syncKeysFromChromeStorage() {
    if (typeof chrome === 'undefined') {
      console.log('Chrome API not available, skipping sync');
      return;
    }

    if (!chrome.storage || !chrome.storage.local) {
      console.log('Chrome storage API not available, skipping sync');
      return;
    }

    if (!chrome.runtime || !chrome.runtime.id) {
      console.log('Chrome runtime not ready, skipping sync');
      return;
    }
    
    try {
      const keys = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Storage operation timeout'));
        }, 3000);

        try {
          chrome.storage.local.get(['C_API_KEY', 'G_API_KEY', 'X_API_KEY'], (result) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result || {});
            }
          });
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });
      
      if (keys.C_API_KEY && keys.C_API_KEY !== this.C_API_KEY) {
        this.C_API_KEY = keys.C_API_KEY;
        localStorage.setItem('C_API_KEY', this.C_API_KEY);
      }
      if (keys.G_API_KEY && keys.G_API_KEY !== this.G_API_KEY) {
        this.G_API_KEY = keys.G_API_KEY;
        localStorage.setItem('G_API_KEY', this.G_API_KEY);
      }
      if (keys.X_API_KEY && keys.X_API_KEY !== this.X_API_KEY) {
        this.X_API_KEY = keys.X_API_KEY;
        localStorage.setItem('X_API_KEY', this.X_API_KEY);
      }
    } catch (error) {
      console.log('Could not sync keys from chrome.storage.local:', error.message || error);
    }
  }

  async reset() {
    this.removeModalWindow(); // Clean up existing modal before resetting
    this.ansArray = [-1, -1, -1, -1, -1];
    this.ansData = [null, null, null, null, null];
    this.currentQuestion = 0;
    this.G_API_KEY = localStorage.getItem('G_API_KEY') || '';
    this.C_API_KEY = localStorage.getItem('C_API_KEY') || '';
    this.X_API_KEY = localStorage.getItem('X_API_KEY') || '';
    this.AI_MODEL = localStorage.getItem('AI_MODEL') || 'gemini-2.5-flash'
    this.modal = null;
    this.modalContent = undefined;
    this.toggleModalBtn = undefined;
    this.closeModelBtn = undefined;
    this.quizData = null;
    this.serverWakeUpTimeStamp = 0;
    await this.syncKeysFromChromeStorage();
    this.AI_MODEL = await this.getAiModel();
    localStorage.setItem('AI_MODEL', this.AI_MODEL);
  }

  createButton(text, bgColor, margin, onClick) {
    const btn = Object.assign(document.createElement('button'), {
      textContent: text,
      style: `margin: ${margin}; padding: 8px 16px; background: ${bgColor}; color: #fff; border: none; border-radius: 4px; cursor: pointer;`
    })
    btn.addEventListener('click', onClick)
    return btn
  }

  createModalWindow() {
    this.removeModalWindow(); // Ensure any existing modal is removed

    this.modal = Object.assign(document.createElement('div'), {
      style: `
            position: fixed; top: 50px; right: 20px; background: #fff; padding: 20px;
            border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            width: auto; height: auto; max-height: 400px; overflow-y: auto; z-index: 10000;
        `
    })

    this.modalContent = Object.assign(document.createElement('div'), {
      id: 'modal-content',
      style: 'margin-bottom: 10px;'
    })

    this.toggleModalBtn = this.createButton(
      'Click',
      '#007bff',
      '0 10px 0 0',
      () => {
        if (this.modalContent.innerHTML) {
          this.modalContent.innerHTML = '' // Clear content
        } else {
          this.toggleModalWindow() // Call function
        }
      }
    )

    this.closeModelBtn = this.createButton('Close', 'red', '0 0 0 10px', () =>
      this.removeModalWindow()
    )

    ;[this.modalContent, this.toggleModalBtn, this.closeModelBtn].forEach(
      (el) => this.modal.appendChild(el)
    )
    document.body.appendChild(this.modal)
  }

  toggleModalWindow() {
    const modalContent = document.getElementById('modal-content')

    let updatedAnsArray = []

    if (this.ansArray.every((ans) => ans === -1)) {
      updatedAnsArray = [...this.ansArray]
    } else {
      updatedAnsArray = this.ansArray.map((ans) => ans + 1)
    }

    const ansToDisplay = updatedAnsArray.map(
      (ans, idx) => `Q${idx + 1}: ${ans}`
    )

    modalContent.innerHTML = `<h3>Quiz Answers</h3><pre>${JSON.stringify(
      ansToDisplay,
      null,
      2
    )}</pre>`
  }

  removeModalWindow() {
    this.modal?.remove()
  }

  getAutoStart() {
    return new Promise((resolve) => {
      if (!QuizSolver.isChromeRuntimeAvailable()) {
        resolve('0');
        return;
      }
      
      if (!chrome.storage || !chrome.storage.sync) {
        resolve('0');
        return;
      }

      const timeout = setTimeout(() => {
        console.log('getAutoStart timeout, using default');
        resolve('0');
      }, 2000);

      try {
        chrome.storage.sync.get('autoStart', function (data) {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.log('Error getting autoStart:', chrome.runtime.lastError);
            resolve('0');
          } else {
            const autoStart = data.autoStart || '0';
            resolve(autoStart);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        console.log('Exception getting autoStart:', error);
        resolve('0');
      }
    })
  }

  getAiModel() {
    return new Promise((resolve) => {
      if (!QuizSolver.isChromeRuntimeAvailable()) {
        resolve('gemini-2.5-flash');
        return;
      }
      
      if (!chrome.storage || !chrome.storage.sync) {
        resolve('gemini-2.5-flash');
        return;
      }

      const timeout = setTimeout(() => {
        console.log('getAiModel timeout, using default');
        resolve('gemini-2.5-flash');
      }, 2000);

      try {
        chrome.storage.sync.get('aiModel', function (data) {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.log('Error getting aiModel:', chrome.runtime.lastError);
            resolve('gemini-2.5-flash');
          } else {
            const aiModel = data.aiModel || 'gemini-2.5-flash';
            resolve(aiModel);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        console.log('Exception getting aiModel:', error);
        resolve('gemini-2.5-flash');
      }
    })
  }

  getWaitFor() {
    return new Promise((resolve) => {
      if (!QuizSolver.isChromeRuntimeAvailable()) {
        resolve(30);
        return;
      }
      
      if (!chrome.storage || !chrome.storage.sync) {
        resolve(30);
        return;
      }

      const timeout = setTimeout(() => {
        console.log('getWaitFor timeout, using default');
        resolve(30);
      }, 2000);

      try {
        chrome.storage.sync.get('delay', function (data) {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.log('Error getting delay:', chrome.runtime.lastError);
            resolve(30);
          } else {
            const delay = data.delay || 30;
            resolve(delay);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        console.log('Exception getting delay:', error);
        resolve(30);
      }
    })
  }

  getBypassFullscreen() {
    return new Promise((resolve) => {
      if (!QuizSolver.isChromeRuntimeAvailable()) {
        resolve('1');
        return;
      }
      
      if (!chrome.storage || !chrome.storage.sync) {
        resolve('1');
        return;
      }

      const timeout = setTimeout(() => {
        console.log('getBypassFullscreen timeout, using default');
        resolve('1');
      }, 2000);

      try {
        chrome.storage.sync.get('bypassFullscreen', function (data) {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.log('Error getting bypassFullscreen:', chrome.runtime.lastError);
            resolve('1');
          } else {
            const bypassFullscreen = data.bypassFullscreen || '1';
            resolve(bypassFullscreen);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        console.log('Exception getting bypassFullscreen:', error);
        resolve('1');
      }
    });
  }

  // Helper to find button by text
  findButtonByText(textOptions) {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => textOptions.some(text => btn.textContent.trim().toLowerCase().includes(text.toLowerCase())));
  }

  startSolvingQuiz() {
    if (this.currentQuestion === this.ansData.length) {
      this.currentQuestion = 0
      console.log('All questions answered')
      // removeModalWindow();
      return
    }
    let correctAnswer = this.ansData[this.currentQuestion]
    
    // New selector for options
    // Escaping brackets for CSS selector: [ -> \\[ and ] -> \\]
    const optionBtns = document.querySelectorAll('button.w-full.rounded-\\[8px\\].cursor-pointer');
    
    console.log(`Question ${this.currentQuestion + 1}: Found ${optionBtns.length} options. Correct Answer Index: ${correctAnswer}`);

    if (optionBtns.length === 0) {
        console.error("No options found! Check selectors.");
        return;
    }

    if (optionBtns.length <= correctAnswer) {
        console.error(`Option index ${correctAnswer} out of bounds. Found ${optionBtns.length} options.`);
        return;
    }

    const optionBtn = optionBtns[correctAnswer];

    // console.log(optionBtn);
    optionBtn.click()
    this.currentQuestion++
    setTimeout(() => {
      // Find submit/next button by text
      const submitBtn = this.findButtonByText(['Next', 'Submit', 'Finish']);
      
      if (submitBtn) {
          console.log("Clicking Submit/Next button");
          submitBtn.click();
      } else {
          console.error("Submit/Next button not found");
      }

      setTimeout(() => {
        this.startSolvingQuiz()
      }, 1000)
    }, 1000)
  }

  async handlePopup() {
    console.log('Checking for popup confirmation...');
    const closeBtn = this.findButtonByText(['Proceed', 'Close', 'Yes']);
    if (closeBtn) {
      console.log('Found popup button, clicking it...');
      closeBtn.click();
      
      console.log('Popup clicked! Quiz is about to start. Activating fullscreen bypass...');
      // await new Promise(resolve => setTimeout(resolve, 300));
      this.exploitFullscreenBypass();
    } else {
      console.log('No popup found, quiz may already be active');
      this.exploitFullscreenBypass();
    }
    
    setTimeout(() => {
      this.main()
    }, 1500)
  }

  async getQuizAnswers(qna) {
    console.log('Starting to get answers from ai')
    // Target the specific background div
    const background = document.querySelector('div.flex-1.pt-8.min-h-\\[78vh\\]') || document.body; 
    
    // Visual cue: Loading
    if (background) background.style.backgroundColor = '#fbfac0'; // Light Yellow

    try {
      const AI_MODELS = {
        gpt: ['gpt-5-mini', 'gpt-4o'],
        gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        grok: ['grok-3-mini', 'grok-2']
      }

      const MODEL_KEYS = {
        gpt: 'C_API_KEY',
        gemini: 'G_API_KEY',
        grok: 'X_API_KEY'
      }

      function getModelType(aiModel) {
        for (const [type, models] of Object.entries(AI_MODELS)) {
          if (models.includes(aiModel)) {
            return type
          }
        }
        return null
      }

      const modelToUse = getModelType(this.AI_MODEL)
      const keyToUse = modelToUse ? this[MODEL_KEYS[modelToUse]] : null

      if (!keyToUse || keyToUse === 'null') {
        throw new Error('API Key not provided')
      }

      if (!modelToUse) {
        throw new Error('Model not found')
      }

      console.log(`Key Used: ${keyToUse}`)
      console.log(`Model Used: ${modelToUse}`)
      console.log('Getting...')

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

      try {
        console.log(qna)
        const response = await fetch(QuizSolver.apiUrl, {
          method: 'POST',
          body: JSON.stringify(qna),
          headers: {
            'Content-Type': 'application/json',
            key: keyToUse,
            model: this.AI_MODEL,
            model_type: modelToUse,
            quiz_url: window.location.href
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log('Response: ', response)

        if (response.ok) {
          console.log('Got response from API...')
          let responseData;
          try {
            responseData = await response.json();
            console.log('API Response:', responseData);
          } catch (error) {
            throw new Error('Failed to parse API response');
          }

          if (responseData.error && responseData.error !== 'null') {
            throw new Error(responseData.error);
          }

          this.ansArray = responseData.result || responseData;
          console.log('Answers:', this.ansArray);

          if (!Array.isArray(this.ansArray) || this.ansArray.length === 0) {
            throw new Error('Invalid response format from API');
          }

          const hasInvalidAnswers = this.ansArray.some((ans) => ans === -1);
          if (hasInvalidAnswers) {
            throw new Error('AI failed to answer some questions. Please check your API key and model selection.');
          }

          this.createModalWindow();
          
          if (background) background.style.backgroundColor = '#ecffec';
          
          const existingErrorContainer = document.getElementById('quiz-solver-error-container');
          if (existingErrorContainer) existingErrorContainer.remove();

          return this.ansArray;
        } else {
          throw new Error(`API request failed with status ${response.status}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Fetch timed out after 90 seconds');
            throw new Error('Request to AI server timed out');
        }
        throw error;
      }
    } catch (error) {
      // Visual cue: Failure
      if (background) background.style.backgroundColor = '#ff605f'; // Light Red
      
      console.error(error)
      console.error('Sorry we failed')
      throw error
    }
  }

  formartQuizData(data) {
    return data.map((item, idx) => ({
      question: item.question.content,
      question_number: idx,
      options: item.question.choices.map((choice, i) => ({
        content: choice.content,
        option_number: i
      }))
    }))
  }

  showErrorPopup(message, onRetry) {
    const background = document.querySelector('div.flex-1.pt-8.min-h-\\[78vh\\]') || document.body;
    if (background) background.style.backgroundColor = '#ff605f';

    if (!document.getElementById('quiz-solver-error-container')) {
      const errorContainer = document.createElement('div');
      errorContainer.id = 'quiz-solver-error-container';
      Object.assign(errorContainer.style, {
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: '10001',
          backgroundColor: 'white',
          border: '3px solid red',
          borderRadius: '8px',
          padding: '15px',
          paddingTop: '35px',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      });

      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      Object.assign(closeButton.style, {
          position: 'absolute',
          top: '5px',
          right: '10px',
          backgroundColor: 'transparent',
          border: 'none',
          fontSize: '24px',
          color: '#999',
          cursor: 'pointer',
          fontWeight: 'bold',
          lineHeight: '1',
          padding: '0',
          width: '30px',
          height: '30px'
      });

      closeButton.addEventListener('click', () => {
        errorContainer.remove();
      });

      closeButton.addEventListener('mouseenter', () => {
        closeButton.style.color = 'red';
      });

      closeButton.addEventListener('mouseleave', () => {
        closeButton.style.color = '#999';
      });

      const errorTitle = document.createElement('div');
      errorTitle.textContent = 'Error Occurred';
      Object.assign(errorTitle.style, {
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'red',
          marginBottom: '10px'
      });

      const errorMessage = document.createElement('div');
      errorMessage.textContent = message;
      Object.assign(errorMessage.style, {
          fontSize: '13px',
          color: '#333',
          marginBottom: '12px',
          wordWrap: 'break-word',
          backgroundColor: '#f9f9f9',
          padding: '8px',
          borderRadius: '4px',
          fontFamily: 'monospace'
      });

      const retryButton = document.createElement('button');
      retryButton.id = 'quiz-solver-retry-btn';
      retryButton.textContent = 'Retry';
      Object.assign(retryButton.style, {
          backgroundColor: 'red',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          width: '100%'
      });
      
      retryButton.addEventListener('click', () => {
        errorContainer.remove();
        if (onRetry) onRetry();
      });

      retryButton.addEventListener('mouseenter', () => {
        retryButton.style.backgroundColor = '#cc0000';
      });

      retryButton.addEventListener('mouseleave', () => {
        retryButton.style.backgroundColor = 'red';
      });

      errorContainer.appendChild(closeButton);
      errorContainer.appendChild(errorTitle);
      errorContainer.appendChild(errorMessage);
      errorContainer.appendChild(retryButton);
      document.body.appendChild(errorContainer);
    }
  }

  async main(qna = null, retryBtn = false) {
    if (retryBtn) {
      if (this.modal !== null) this.removeModalWindow()
    }

    // Use intercepted data if available
    if (!qna && this.quizData) {
        qna = this.quizData;
    }

    if (!qna) {
        const msg = "No quiz data available. Interceptor might have missed the request or page hasn't loaded data yet.";
        console.error(msg);
        this.showErrorPopup(msg, () => {
            this.reset();
            this.main(qna, true);
        });
        return;
    }

      try {
        this.ansData = await this.getQuizAnswers(qna)
        this.startSolvingQuiz()
      } catch (error) {
        this.showErrorPopup(error.message || String(error), () => {
            this.reset();
            this.main(qna, true);
        });
        console.error('Quiz Solver Error:', error);
      }
  }

  async exploitFullscreenBypass() {
    const bypassEnabled = this.bypassEnabled;
    
    if (bypassEnabled !== '1') {
      console.log('Fullscreen bypass is disabled in settings');
      return false;
    }

    console.log('Activating fullscreen bypass exploit...');
    console.log('Step 1: Checking Chrome runtime availability...');
    
    if (typeof chrome === 'undefined') {
      console.log('Chrome object not available, bypass skipped');
      return false;
    }

    if (!chrome.runtime) {
      console.log('chrome.runtime not available, waiting for initialization...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!chrome.runtime) {
        console.log('chrome.runtime still not available after wait, bypass skipped');
        return false;
      }
    }

    try {
      if (!chrome.runtime.id) {
        console.log('Extension context invalidated (no runtime.id), bypass skipped');
        return false;
      }

      if (!chrome.runtime.sendMessage) {
        console.log('chrome.runtime.sendMessage not available, bypass skipped');
        return false;
      }

      console.log('Step 2: Sending message to background script...');
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: No response from background script'));
        }, 5000);

        chrome.runtime.sendMessage(
          { action: 'bypassFullscreen' },
          (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });
      
      console.log('Step 3: Received response from background:', response);
      
      if (response && response.success) {
        console.log('Fullscreen bypass successful! Quiz running without restrictions.');
        return true;
      } else {
        console.log('Fullscreen bypass failed:', response ? response.error : 'No response');
        return false;
      }
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('Extension was reloaded. Bypass skipped. Reload the page to use bypass.');
      } else if (error.message && error.message.includes('Timeout')) {
        console.log('Background script did not respond in time:', error.message);
      } else {
        console.log('Fullscreen bypass error:', error.message || error);
      }
      return false;
    }
  }

  async start(clickButton = true) {
    console.log('Starting quiz sequence...')
    
    if (clickButton) {
        const quizBtn = this.findButtonByText(['Start Quiz', 'Retake Quiz']);
        if (quizBtn) {
            const buttonText = quizBtn.textContent.trim();
            console.log(`Auto-clicking ${buttonText} button`);
            quizBtn.click();
        } else {
            console.log("Start Quiz or Retake Quiz button not found for auto-start");
        }
    }
    
    console.log('Waiting 1000 before handling popup...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.handlePopup();
  }

  waitForElement(selector, textOptions, maxWaitTime = 30000) {
    return new Promise((resolve) => {
      let timeoutId = null;
      let observer = null;
      let bodyObserver = null;
      let resolved = false;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (bodyObserver) {
          bodyObserver.disconnect();
          bodyObserver = null;
        }
      };
      
      const checkElement = () => {
        if (resolved) return false;
        
        if (selector) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              resolved = true;
              cleanup();
              resolve(elements);
              return true;
            }
          } catch (e) {
            console.error('Error querying selector:', e);
          }
        }
        
        if (textOptions && textOptions.length > 0) {
          const button = this.findButtonByText(textOptions);
          if (button) {
            resolved = true;
            cleanup();
            resolve(button);
            return true;
          }
        }
        
        return false;
      };

      if (checkElement()) {
        return;
      }

      observer = new MutationObserver(() => {
        checkElement();
      });

      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      } else {
        bodyObserver = new MutationObserver(() => {
          if (document.body && observer) {
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
            checkElement();
          }
        });
        bodyObserver.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }

      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          console.log(`Timeout waiting for element (${maxWaitTime}ms). Proceeding anyway...`);
          resolve(null);
        }
      }, maxWaitTime);
    });
  }

  async init() {
    console.log('Initializing auto quiz solver - waiting for Start Quiz or Retake Quiz button...')
    
    const quizBtn = await this.waitForElement(null, ['Start Quiz', 'Retake Quiz'], this.delay * 1000);
    
    if (!quizBtn) {
        console.log("Start Quiz or Retake Quiz button not found on this page.");
        return;
    }
    
    const buttonText = quizBtn.textContent.trim();
    console.log(`${buttonText} button detected and ready!`);
    quizBtn.style.backgroundColor = 'green';
    quizBtn.style.color = 'white';
    quizBtn.style.border = '2px solid #00ff00';
    
    quizBtn.addEventListener('click', async () => {
      console.log(`User clicked ${buttonText} - extension taking over...`);
      await this.start(false);
    });
  }

  wakeUpServer() {
    console.log('Waking up server...')
    fetch(QuizSolver.apiUrl, { method: 'GET' })
      .then(res => console.log('Server wake-up signal sent:', res.status))
      .catch(err => console.log('Server wake-up failed (non-critical):', err));
  }

  setupURLChangeDetection() {
    let lastUrl = window.location.href;
    console.log('Setting up URL change detection for SPA navigation');

    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.handleUrlChange(currentUrl);
      }
    };
    const observer = new MutationObserver(() => {
      checkUrlChange();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      });
    }
  }

  handleUrlChange(url) {
    const lessonsRegex = /\/livebooks\/\d+\/[a-f0-9-]+\/lessons$/;
    
    // Check for broader livebook match to wake up server early
    if (/\/livebooks\/\d+/.test(url)) {
      console.log('Livebook page detected. Waking up server...');
      //Wakeup server only if it has been more than 10 minutes since last wakeup or if it has never been woken up
      if (!this.serverWakeUpTimeStamp || Date.now() - this.serverWakeUpTimeStamp > 600000) {
        this.wakeUpServer();
        this.serverWakeUpTimeStamp = Date.now();
      }
    }
    
    if (lessonsRegex.test(url)) {
      console.log('Quiz page detected via URL change. Reinitializing...');
      setTimeout(() => {
        this.initialize(false);
      }, 500);
    } else {
      console.log('Not a quiz page URL. Skipping initialization.');
    }
  }

  async initializeCore() {
    console.log('Initializing core configuration...');

    this.autoStart = await this.getAutoStart()
    this.bypassEnabled = await this.getBypassFullscreen()
    this.AI_MODEL = await this.getAiModel()
    this.delay = await this.getWaitFor()

    // Check if all three API keys are missing
    const allKeysMissing = !this.C_API_KEY && !this.G_API_KEY && !this.X_API_KEY;
    
    if (allKeysMissing) {
        const cKey = prompt('Please enter your OpenAI API Key (or leave empty to skip)');
        if (cKey && cKey.trim()) {
            this.C_API_KEY = String(cKey.trim());
            localStorage.setItem('C_API_KEY', this.C_API_KEY);
            if (QuizSolver.isChromeRuntimeAvailable() && chrome.storage) {
              chrome.storage.local.set({ C_API_KEY: this.C_API_KEY });
            }
            console.log('OpenAI API Key Provided:', this.C_API_KEY);
        }

        const gKey = prompt('Please enter your Google API Key (or leave empty to skip)');
        if (gKey && gKey.trim()) {
            this.G_API_KEY = String(gKey.trim());
            localStorage.setItem('G_API_KEY', this.G_API_KEY);
            if (QuizSolver.isChromeRuntimeAvailable() && chrome.storage) {
              chrome.storage.local.set({ G_API_KEY: this.G_API_KEY });
            }
            console.log('Google API Key Provided:', this.G_API_KEY);
        }

        const xKey = prompt('Please enter your Grok API Key (or leave empty to skip)');
        if (xKey && xKey.trim()) {
            this.X_API_KEY = String(xKey.trim());
            localStorage.setItem('X_API_KEY', this.X_API_KEY);
            if (QuizSolver.isChromeRuntimeAvailable() && chrome.storage) {
              chrome.storage.local.set({ X_API_KEY: this.X_API_KEY });
            }
            console.log('Grok API Key Provided:', this.X_API_KEY);
        }
    }

    console.log('Core configuration initialized');
    console.log('Max wait time (delay): ', this.delay, 'seconds')
    console.log('Auto Start: ', this.autoStart === '1' ? 'Yes' : 'No')
    console.log('AI Model: ', this.AI_MODEL)
  }

  async initialize(checkUrl = true) {
    console.log('Initializing extension...');
    
    await this.reset();
    
    if (checkUrl) {
    const lessonsRegex = /\/livebooks\/\d+\/[a-f0-9-]+\/lessons$/;
    if (!lessonsRegex.test(window.location.href)) {
      console.log('URL validation failed or not a quiz page.');
      return;
    } else {
        console.log('URL matches lesson page structure. Script will activate.');
      }
    }

    await this.initializeCore();

    if (this.autoStart === '1') {
      console.log('Auto-start enabled. Waiting for Start Quiz or Retake Quiz button...');
      const quizBtn = await this.waitForElement(null, ['Start Quiz', 'Retake Quiz'], this.delay * 1000);
      if (quizBtn) {
        const buttonText = quizBtn.textContent.trim();
        console.log(`${buttonText} button detected. Auto-clicking...`);
        this.start(true);
      } else {
        console.log('Start Quiz or Retake Quiz button not found within timeout.');
      }
    } else {
      await this.init();
    }

    console.log('Initialization complete');
    console.log('Foreground script running')
    console.log('Using smart DOM detection - will proceed as soon as elements are ready')
  }

  async runScript() {
    console.log('Running auto quiz solver')

    if (QuizSolver.isChromeRuntimeAvailable() && chrome.runtime.getURL) {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('interceptor.js');
      script.onload = function() {
          this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
      console.log("Interceptor injected from script.js via SRC");
    } else {
      console.log("Chrome runtime not available, skipping interceptor injection");
    }

    // Listen for intercepted data
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data.type && event.data.type === 'QUIZ_DATA_INTERCEPTED') {
            // console.log("Content Script: Received data from", event.data.source);
            
            let rawData = event.data.data;
            let qna = null;

            if (event.data.source === 'GLOBAL') {
                // Try to find the attempt info in the deep object
                // This is a heuristic search
                const findAttemptInfo = (obj) => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj.attempt_info) return obj.attempt_info;
                    if (Array.isArray(obj)) {
                        for (let item of obj) {
                            const found = findAttemptInfo(item);
                            if (found) return found;
                        }
                    } else {
                        for (let key in obj) {
                            const found = findAttemptInfo(obj[key]);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                
                const attemptInfo = findAttemptInfo(rawData);
                if (attemptInfo) {
                    console.log("Content Script: Extracted attempt_info from GLOBAL data");
                    qna = this.formartQuizData(attemptInfo);
                } else {
                    console.log("Content Script: Could not find attempt_info in GLOBAL data");
                }
            } else {
                // API source
                qna = this.formartQuizData(rawData.attempt_info || rawData);
            }

            if (qna) {
                this.quizData = qna;
                // console.log("Quiz data stored. Ready to solve.");
            }
        }
    });

    // Wait for DOM for the rest
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
        this.initialize();
    }
  }
}

console.log('Background script running')
const quizSolver = new QuizSolver()

// Set up URL change detection IMMEDIATELY before React Router initializes
quizSolver.setupURLChangeDetection();

quizSolver.runScript()
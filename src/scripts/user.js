let timeLeft = 30;
let timerInterval;
let points = 0;
let currentQuestion = null;
let currentQuestionId = null;
let wasPaused = false;
let revealShownForQuestion = null;
let userSubmittedAnswer = null; // store user's current submitted answer (lowercase)

// Cache DOM elements
const questionEl = document.getElementById('question');
const answerInput = document.getElementById('answerInput');
const submitBtn = document.getElementById('submitBtn');
const timerEl = document.getElementById('timer');
const pointsEl = document.getElementById('points');
const quizBody = document.querySelector('.quiz-body');
const waitingMessageEl = document.getElementById('waitingMessage');
const submittedAnswerDisplay = document.getElementById('submittedAnswerDisplay');

function displayUsername() {
    const username = sessionStorage.getItem("username") || "Guest";
    const initial = username.charAt(0).toUpperCase();
    const usernameElement = document.getElementById("usernameDisplay");
    usernameElement.innerHTML = `
        <div class="profile-circle">${initial}</div>
        <span>${username}</span>
    `;
}

function setQuizActive(active, message) {
    timerEl.style.visibility = active ? 'visible' : 'hidden';
    pointsEl.style.visibility = active ? 'visible' : 'hidden';

    if (!active) {
        questionEl.innerHTML = `
          <div style="display:flex; flex-direction: column; align-items: center; gap: 12px;">
            <div class="loader"></div>
            <div class="waiting-text animated-gradient">${message || "Waiting for admin to start the quiz..."}</div>
          </div>
        `;
        quizBody.style.display = 'none';
        answerInput.value = "";
        answerInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        waitingMessageEl.style.display = 'none';
        updateSubmittedAnswerDisplay(null);
    } else {
        questionEl.textContent = currentQuestion?.questionText || "No question";
        quizBody.style.display = 'flex';
        answerInput.value = "";
        answerInput.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        waitingMessageEl.style.display = 'none';
        updateSubmittedAnswerDisplay(null);
    }
}

function startTimer() {
    timeLeft = 30;
    updateTimerColor(timeLeft);
    updateTimerDisplay();
    clearInterval(timerInterval);

    if (submitBtn) submitBtn.disabled = false;
    answerInput.disabled = false;
    waitingMessageEl.style.display = 'none';

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerColor(timeLeft);
        updateTimerDisplay();

        if (timeLeft <= 0) {
            timeLeft = 0;
            clearInterval(timerInterval);
            if (submitBtn) submitBtn.disabled = true;
            answerInput.disabled = true;
            showPopup("⏰ Time's up!", "error");
            submitAnswer(true);

            waitingMessageEl.innerHTML = `
              <div class="loader"></div>
              <div style="margin-left:10px;">Waiting for admin to reveal the answer...</div>
            `;
            waitingMessageEl.style.display = 'flex';
            quizBody.style.display = 'none';
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    if (submitBtn) submitBtn.disabled = true;
    answerInput.disabled = true;
}

function updateTimerDisplay() {
    timerEl.textContent = `${timeLeft}s`;
}

function updateTimerColor(secondsLeft) {
    timerEl.classList.remove("timer-green", "timer-orange", "timer-red");
    if (secondsLeft > 20) timerEl.classList.add("timer-green");
    else if (secondsLeft > 10) timerEl.classList.add("timer-orange");
    else timerEl.classList.add("timer-red");
}

function calculatePoints(secondsLeft) {
    if (secondsLeft >= 26) return 15;
    if (secondsLeft >= 21) return 12;
    if (secondsLeft >= 11) return 10;
    if (secondsLeft >= 6) return 8;
    if (secondsLeft >= 1) return 5;
    return 0;
}

function updateSubmittedAnswerDisplay(answer) {
    if (!answer) {
        submittedAnswerDisplay.textContent = "";
        userSubmittedAnswer = null;
    } else {
        submittedAnswerDisplay.textContent = `Answer submitted: ${answer}`;
        userSubmittedAnswer = answer.toLowerCase();
    }
}

async function submitAnswer(autoSubmit = false) {
    clearInterval(timerInterval);

    if (answerInput.disabled) return;

    const userAnswer = answerInput.value.trim();
    if (!autoSubmit && !userAnswer) {
        showPopup("Please enter an answer.", "error");
        return;
    }

    userSubmittedAnswer = userAnswer.toLowerCase();

    // Save answer locally for this question to persist across reloads
    if (currentQuestionId) {
        sessionStorage.setItem(`answer_${currentQuestionId}`, userSubmittedAnswer);
    }

    const userId = sessionStorage.getItem('userId');
    if (!userId || !currentQuestionId) {
        showPopup("User or question not initialized.", "error");
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    answerInput.disabled = true;

    try {
        // No Firestore save as per user request
        showPopup(`✅ Answer submitted!`, "success");

        updateSubmittedAnswerDisplay(userAnswer);

        quizBody.style.display = 'none';
        waitingMessageEl.innerHTML = `
          <div class="loader"></div>
          <div style="margin-left:10px;">Waiting for admin to reveal the answer...</div>
        `;
        waitingMessageEl.style.display = 'flex';

    } catch (err) {
        console.error(err);
        showPopup("Failed to submit answer.", "error");
        if (submitBtn) submitBtn.disabled = false;
        answerInput.disabled = false;
    }
}

function showPopup(message, type = "info") {
    const popup = document.createElement("div");
    popup.className = `popup-message ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add("show"), 10);
    setTimeout(() => {
        popup.classList.remove("show");
        setTimeout(() => popup.remove(), 300);
    }, 1800);
}

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('toggle');
});
function closeMenu() {
    navLinks.classList.remove('open');
    hamburger.classList.remove('toggle');
}
function logout() {
    sessionStorage.clear();
    window.location.href = '../pages/login.html';
}

const liveDoc = db.collection('live').doc('current');
liveDoc.onSnapshot(async (doc) => {
    if (!doc.exists) return;
    const data = doc.data();
    console.log("Live quiz data:", data);

    if (data.isStarted && !data.isPaused) {
        if (!data.activeQuestionRef && currentQuestionId) {
            data.activeQuestionRef = db.collection('questions').doc(currentQuestionId);
            console.log("Reusing previous activeQuestionRef:", currentQuestionId);
        }
    }

    if (data.isStarted) {
        if (data.isPaused) {
            if (!wasPaused) {
                pauseTimer();
                showPopup("Quiz Paused", "info");
                answerInput.disabled = true;
                if (submitBtn) submitBtn.disabled = true;
                wasPaused = true;
                waitingMessageEl.style.display = 'none';
            }
        } else {
            if (wasPaused) {
                setQuizActive(true);
                showPopup("Quiz resumed by admin", "success");
                answerInput.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
                wasPaused = false;
                if (!data.revealAnswer) startTimer();
                waitingMessageEl.style.display = 'none';
            } else {
                if (!data.revealAnswer) setQuizActive(true);
                waitingMessageEl.style.display = 'none';
            }
        }
    } else {
        pauseTimer();
        setQuizActive(false, "Quiz has ended or is not started yet.");
        answerInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        wasPaused = false;
        currentQuestion = null;
        currentQuestionId = null;
        revealShownForQuestion = null;
        waitingMessageEl.style.display = 'none';
        updateSubmittedAnswerDisplay(null);
        return;
    }

    if (data.activeQuestionRef) {
        try {
            let qDoc;
            if (data.activeQuestionRef && typeof data.activeQuestionRef.get === 'function') {
                qDoc = await data.activeQuestionRef.get();
            } else if (typeof data.activeQuestionRef === 'string') {
                qDoc = await db.collection('questions').doc(data.activeQuestionRef).get();
            } else {
                questionEl.textContent = "No active question set.";
                quizBody.style.display = 'none';
                pauseTimer();
                waitingMessageEl.style.display = 'none';
                updateSubmittedAnswerDisplay(null);
                return;
            }

            if (qDoc.exists) {
                if (revealShownForQuestion !== qDoc.id) {
                    revealShownForQuestion = null;
                    userSubmittedAnswer = null;
                }

                currentQuestion = qDoc.data();
                currentQuestionId = qDoc.id;
                questionEl.textContent = currentQuestion.questionText || "No question";
                answerInput.value = "";

                // Load submitted answer from sessionStorage if any
                const storedAnswer = sessionStorage.getItem(`answer_${currentQuestionId}`);
                if (storedAnswer) {
                    userSubmittedAnswer = storedAnswer;
                    updateSubmittedAnswerDisplay(userSubmittedAnswer);
                } else {
                    userSubmittedAnswer = null;
                    updateSubmittedAnswerDisplay(null);
                }

                if (!data.isPaused) {
                    if (!data.revealAnswer) {
                        startTimer();
                        answerInput.disabled = false;
                        if (submitBtn) submitBtn.disabled = false;
                        quizBody.style.display = 'flex';
                        waitingMessageEl.style.display = 'none';
                    } else {
                        // Reveal phase: hide inputs, stop timer
                        quizBody.style.display = 'none';
                        waitingMessageEl.style.display = 'none';
                        pauseTimer();
                    }
                } else {
                    answerInput.disabled = true;
                    if (submitBtn) submitBtn.disabled = true;
                    pauseTimer();
                    quizBody.style.display = 'none';
                    waitingMessageEl.style.display = 'none';
                }
            } else {
                questionEl.textContent = "Question not found.";
                quizBody.style.display = 'none';
                pauseTimer();
                waitingMessageEl.style.display = 'none';
                updateSubmittedAnswerDisplay(null);
            }
        } catch (err) {
            console.error("Error fetching question doc:", err);
            questionEl.textContent = "Failed to load question.";
            quizBody.style.display = 'none';
            pauseTimer();
            waitingMessageEl.style.display = 'none';
            updateSubmittedAnswerDisplay(null);
        }
    } else {
        questionEl.innerHTML = `
          <div style="display:flex; flex-direction: column; align-items: center; gap: 12px;">
            <div class="loader"></div>
            <div class="waiting-text animated-gradient">Waiting for admin to select the next question...</div>
          </div>
        `;
        quizBody.style.display = 'none';
        pauseTimer();
        waitingMessageEl.style.display = 'none';
        updateSubmittedAnswerDisplay(null);
    }

    // On answer reveal
    if (data.revealAnswer && revealShownForQuestion !== currentQuestionId) {
        revealShownForQuestion = currentQuestionId;

        const correctAnswer = (currentQuestion?.answer || "").toLowerCase();
        const userId = sessionStorage.getItem('userId');

        // ALWAYS get the answer from sessionStorage at reveal to avoid lost state
        const storedAnswer = sessionStorage.getItem(`answer_${currentQuestionId}`);

        if (!storedAnswer) {
            showPopup(`No answer submitted. Correct answer: ${correctAnswer}`, 'info');
            updateSubmittedAnswerDisplay(null);
        } else {
            const userAnswerLower = storedAnswer.toLowerCase();
            const isCorrect = (userAnswerLower === correctAnswer);

            if (isCorrect) {
                const awardedPoints = calculatePoints(timeLeft);
                points += awardedPoints;
                pointsEl.textContent = `Points: ${points}`;

                if (userId) {
                    const userDocRef = db.collection('users').doc(userId);
                    const userDoc = await userDocRef.get();
                    if (userDoc.exists) {
                        const currentScore = userDoc.data().score || 0;
                        await userDocRef.update({ score: currentScore + awardedPoints });
                    }
                }

                showPopup(`🎉 Congratulations! You earned ${awardedPoints} points.`, 'success');
            } else {
                showPopup(`Wrong! Correct answer: ${correctAnswer}`, 'error');
            }
            updateSubmittedAnswerDisplay(storedAnswer);
        }

        waitingMessageEl.style.display = 'none';
        quizBody.style.display = 'none';
        pauseTimer();
    }
});

window.onload = () => {
    console.log("Loaded page, username:", sessionStorage.getItem("username"), "userId:", sessionStorage.getItem("userId"));
    displayUsername();
    setQuizActive(false, "Waiting for admin to start the quiz...");
    waitingMessageEl.style.display = 'none';
    updateSubmittedAnswerDisplay(null);
};

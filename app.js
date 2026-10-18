if (typeof window.currentExtractedTexture === 'undefined') {
  window.currentExtractedTexture = null;
}
var currentExtractedTexture = window.currentExtractedTexture;

if (typeof createFallbackDummyTexture === 'undefined') {
  window.createFallbackDummyTexture = function(color1, color2) {
    var c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    var ctx = c.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, color1 || '#ffffff');
    grad.addColorStop(1, color2 || '#e5e7eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
    return c.toDataURL('image/png');
  };
}

var ALL_SCREENS = [
  'screen-cover', 'screen-menu', 'screen-gallery', 'screen-intro', 'screen-guide',
  'screen-opening', 'screen-survey', 
  'screen-survey-core-concern', 'screen-survey-concern-reason', 
  'screen-top7-bridge',
  'screen-survey-concern-top7',
  'screen-post-concern-bridge', 'screen-capture-guide', 
  'screen-shape-select', 'screen-survey-bridge',
  'screen-loading', 'screen-preview', 'screen-complete', 'screen-share'
];

// 🌟 '나비 만들기' 내부 과정 페이지들을 제외한 5개 페이지에서만 배경 입자 및 손끝 윤슬 이펙트 허용
function isCoverWaveAllowed(screenId) {
  return (
    screenId === 'screen-cover' ||
    screenId === 'screen-menu' ||
    screenId === 'screen-gallery' ||
    screenId === 'screen-intro' ||
    screenId === 'screen-guide'
  );
}

var showcaseInterval = null;
var currentStepIdx = 0;
var userSelections = { q1: [], q2: [], q1_custom: "", q2_custom: "", core_concern: "", concern_reason: "", q6_memo: "", q7_name: "" };
var lastInjectedCustomKeyword = "";

var completeTypeTimer = null;
var shareTypeTimer = null;
var autoTransitionTimer = null;
var reasonTypeTimer = null;
var top7BridgeTypeTimer = null;
var postConcernTypeTimer = null;
var flightSafetyTimer = null;
var typeTimer = null;
var guideTypeTimer = null;
var surveyTitleTypeTimer = null;
var coreConcernTypeTimer = null;
var openingDelayTimer = null;
var auxTimers = [];

var lastSavedButterflyId = null;
var currentSavePromise = null;
var hasSeenCaptureGuideAnimation = false;

function registerAuxTimer(fn, delay) {
  var tid = setTimeout(fn, delay);
  auxTimers.push(tid);
  return tid;
}

function clearAllTimers() {
  clearTimeout(typeTimer);
  clearTimeout(guideTypeTimer);
  clearTimeout(surveyTitleTypeTimer);
  clearTimeout(coreConcernTypeTimer);
  clearTimeout(reasonTypeTimer);
  clearTimeout(top7BridgeTypeTimer);
  clearTimeout(openingDelayTimer);
  clearTimeout(completeTypeTimer);
  clearTimeout(shareTypeTimer);
  clearTimeout(autoTransitionTimer);
  clearTimeout(postConcernTypeTimer);
  clearTimeout(flightSafetyTimer);
  if (auxTimers && auxTimers.length > 0) {
    auxTimers.forEach(function(t) { clearTimeout(t); });
    auxTimers = [];
  }
  if (showcaseInterval) { clearInterval(showcaseInterval); showcaseInterval = null; }
}

function removeInjectedCustomFromQ2() {
  if (!lastInjectedCustomKeyword) return;
  var baseOptions = (surveyQuestions[1] && surveyQuestions[1].options) ? surveyQuestions[1].options : [];
  if (baseOptions.indexOf(lastInjectedCustomKeyword) === -1) {
    var idx = userSelections.q2.indexOf(lastInjectedCustomKeyword);
    if (idx > -1) {
      userSelections.q2.splice(idx, 1);
    }
  }
  lastInjectedCustomKeyword = "";
}

function syncCustomKeywordToQ2() {
  removeInjectedCustomFromQ2();
  if (userSelections.q2_custom && userSelections.q2_custom.trim()) {
    var c = userSelections.q2_custom.trim();
    if (userSelections.q2.indexOf(c) === -1) {
      userSelections.q2.unshift(c);
      lastInjectedCustomKeyword = c;
    }
  }
}

// 🌟 메인화면(#screen-cover) 진입 및 복귀 시 로고 붓글씨 -> 부제목 -> 마지막에 '시작하기' 버튼이 나오는 시퀀스를 처음부터 동일하게 재생
function replayCoverIntroAnimation() {
  var coverEl = document.getElementById('screen-cover');
  if (!coverEl) return;

  var logoEl = coverEl.querySelector('.cover-anim-logo');
  var descEl = coverEl.querySelector('.cover-anim-desc');
  var coverDock = document.getElementById('cover-bottom-dock') || coverEl.querySelector('.cover-anim-btn');
  var startBtn = document.getElementById('btn-start-cover');
  var strokes = coverEl.querySelectorAll('.noul-brush-stroke');

  // 1. 인라인 강제 스타일 해제 및 CSS 애니메이션 일시 중지
  if (logoEl) logoEl.style.animation = 'none';
  if (descEl) descEl.style.animation = 'none';
  if (coverDock) {
    coverDock.style.removeProperty('opacity');
    coverDock.style.removeProperty('transform');
    coverDock.style.setProperty('display', 'flex', 'important');
    coverDock.style.setProperty('visibility', 'visible', 'important');
    coverDock.style.setProperty('pointer-events', 'auto', 'important');
    coverDock.style.animation = 'none';
  }
  if (startBtn) {
    startBtn.style.setProperty('display', 'block', 'important');
    startBtn.style.setProperty('visibility', 'visible', 'important');
    startBtn.style.setProperty('pointer-events', 'auto', 'important');
  }
  strokes.forEach(function(s) {
    s.style.animation = 'none';
  });

  // 2. 브라우저 강제 리플로우(Reflow)로 애니메이션 타임라인 초기화
  void coverEl.offsetWidth;

  // 3. CSS에 정의된 순차 애니메이션(로고 7획 -> 부제목 -> 3.35초에 시작하기 버튼 등장) 재시작
  if (logoEl) logoEl.style.animation = '';
  if (descEl) descEl.style.animation = '';
  if (coverDock) coverDock.style.animation = '';
  strokes.forEach(function(s) {
    s.style.animation = '';
  });

  // 4. 애니메이션이 모두 끝나는 시점(4.2초)에 혹시 모를 브라우저 렌더링 누락을 방지하는 최종 안전장치
  registerAuxTimer(function() {
    var activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-cover' && coverDock) {
      coverDock.style.opacity = '1';
      coverDock.style.transform = 'translateY(0)';
    }
  }, 4200);
}

function showScreen(screenId) {
  clearAllTimers();
  var menuEl = document.getElementById('screen-menu');
  if (menuEl) menuEl.classList.remove('dramatic-exit');

  document.querySelectorAll('.screen').forEach(function(s) { 
    s.classList.remove('active'); 
    s.style.display = 'none';
  });

  if (screenId !== 'screen-preview' && typeof stopFullButterflyViewer === 'function') {
    stopFullButterflyViewer();
  }

  var target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'flex';

    // 🌟 시작페이지(#screen-cover)로 진입하거나 돌아왔을 때 애니메이션을 처음부터 재생하여 마지막에 시작하기 버튼이 나오도록 실행
    if (screenId === 'screen-cover') {
      replayCoverIntroAnimation();
    }

    try {
      // 🌟 '나비 만들기' 외의 페이지(표지, 메뉴, 둘러보기, 전시소개, 관람안내)에서는 캔버스 유지, 그 외에는 중지
      if (isCoverWaveAllowed(screenId)) {
        if (typeof coverAnimId === 'undefined' || !coverAnimId) {
          initCoverWaveCanvas();
        }
      } else {
        stopCoverWaveCanvas();
      }

      if (screenId === 'screen-cover' || screenId === 'screen-menu' || screenId === 'screen-intro' || screenId === 'screen-guide') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene();
      } else if (screenId === 'screen-opening') {
        lastSavedButterflyId = null;
        currentSavePromise = null;
        hasSeenCaptureGuideAnimation = false;
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); resetOpeningFlow();
      } else if (screenId === 'screen-survey') {
        stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); renderSurveyStep();
      } else if (screenId === 'screen-survey-core-concern') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); initCoreConcernScreen();
      } else if (screenId === 'screen-survey-concern-reason') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); initConcernReasonScreen();
      } else if (screenId === 'screen-top7-bridge') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); initTop7BridgeScreen();
      } else if (screenId === 'screen-survey-concern-top7') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); updateTop7PickedSubtitle();
        // 🌟 실제 데이터 집계 후 현재 화면이 여전히 top7일 때만 동적으로 공 물리 화면 초기화
        fetchTopKeywordsData().then(function(realTopList) {
          var currentActive = document.querySelector('.screen.active');
          if (currentActive && currentActive.id === 'screen-survey-concern-top7') {
            initTop7PhysicsScene(realTopList);
          }
        });
      } else if (screenId === 'screen-post-concern-bridge') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); initPostConcernBridgeScreen();
      } else if (screenId === 'screen-capture-guide') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); startCaptureGuideCinematicFlow();
      } else if (screenId === 'screen-shape-select') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene();
        if (typeof switchTab === 'function') switchTab('wing');
        if (typeof updateHeroPreview === 'function') updateHeroPreview();
        if (typeof drawAlignCanvas === 'function') drawAlignCanvas();
      } else if (screenId === 'screen-gallery') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); initSpecimenGallery();
      } else if (screenId === 'screen-survey-bridge') {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); playBridgeTypingSequence();
      } else if (screenId === 'screen-loading') {
        stopBubblePhysics(); stopShare3DScene(); stopTop7PhysicsScene();
      } else if (screenId === 'screen-complete') {
        stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene(); playCompleteScreenSequence();
      } else if (screenId === 'screen-share') {
        stopLoading3DScene(); stopTop7PhysicsScene(); initShare3DScene(); playShareScreenSequence();
      } else {
        stopBubblePhysics(); stopLoading3DScene(); stopShare3DScene(); stopTop7PhysicsScene();
      }
    } catch(e) {
      console.warn("화면 진입 시각효과 경고:", e);
    }
  }
  updateDevScreenBadge();
}

function transitionToScreenWithFade(targetScreenId) {
  var curtain = document.getElementById('cinematic-transition-curtain');
  if (!curtain) { showScreen(targetScreenId); return; }
  curtain.classList.remove('dramatic-slow-fade');
  curtain.classList.add('active-curtain');
  setTimeout(function() {
    showScreen(targetScreenId);
    requestAnimationFrame(function() {
      setTimeout(function() { curtain.classList.remove('active-curtain'); }, 80);
    });
  }, 480);
}

function transitionToOpeningDramatic() {
  var curtain = document.getElementById('cinematic-transition-curtain');
  var menuScreen = document.getElementById('screen-menu');
  if (!curtain) {
    showScreen('screen-opening');
    return;
  }
  if (menuScreen) {
    menuScreen.classList.add('dramatic-exit');
  }
  curtain.classList.add('dramatic-slow-fade');
  curtain.classList.add('active-curtain');

  setTimeout(function() {
    showScreen('screen-opening');
    requestAnimationFrame(function() {
      setTimeout(function() {
        curtain.classList.remove('active-curtain');
        setTimeout(function() {
          curtain.classList.remove('dramatic-slow-fade');
        }, 2300);
      }, 150);
    });
  }, 2250);
}

function updateDevScreenBadge() {
  var badge = document.getElementById('dev-current-screen-badge');
  if (!badge) return;
  var activeScreen = document.querySelector('.screen.active');
  var name = activeScreen ? activeScreen.id : 'none';
  if (name === 'screen-opening') name += ' (' + openingCurrentStep + '/3: 오프닝대사)';
  else if (name === 'screen-survey') {
    if (currentStepIdx === 0) name += ' (1/3: 이름)';
    else if (currentStepIdx === 1) name += ' (2/3: 고민선택)';
    else if (currentStepIdx === 2) name += ' (3/3: 다정한한마디)';
  } else if (name === 'screen-survey-core-concern') name += ' (핵심고민)';
  else if (name === 'screen-survey-concern-reason') name += ' (고민이유)';
  else if (name === 'screen-top7-bridge') name += ' (고민탑7브릿지)';
  else if (name === 'screen-survey-concern-top7') name += ' (고민탑7)';
  else if (name === 'screen-post-concern-bridge') name += ' (나비전환브릿지)';
  badge.innerText = '화면: ' + name;
}

function startAnswerShowcaseSequence() {
  if (showcaseInterval) { clearInterval(showcaseInterval); showcaseInterval = null; }
  initLoading3DScene();

  var pBar = document.getElementById('generation-progress-bar'), progress = 0;
  if (pBar) pBar.style.width = '0%';
  
  var intervalDelay = 100;
  var stepIncrease = 100 / (10000 / intervalDelay);

  showcaseInterval = setInterval(function() {
    progress += stepIncrease;
    if (pBar) pBar.style.width = Math.min(100, progress) + '%';
    if (progress >= 100) {
      clearInterval(showcaseInterval); showcaseInterval = null;
      registerAuxTimer(function() {
        var whiteFlash = document.getElementById('cinematic-white-flash');
        if (whiteFlash) whiteFlash.classList.add('flash-active');
        
        registerAuxTimer(function() {
          stopLoading3DScene();
          var butterflyName = userSelections.q7_name ? userSelections.q7_name.trim() : "나비";
          var nameHeader = document.getElementById('preview-butterfly-name');
          if (nameHeader) nameHeader.innerText = '‘' + butterflyName + '’';

          var guideText = document.getElementById('preview-guide-text');
          if (guideText) {
            guideText.innerText = userSelections.q6_memo && userSelections.q6_memo.trim().length > 0 
              ? userSelections.q6_memo.trim() : "너의 찬란한 날갯짓을 응원해.";
          }
          
          var flyLabel = document.getElementById('preview-fly-label');
          if (flyLabel) {
            flyLabel.innerHTML = "화면 아무 곳을<br>2초간 길게 눌러 기를 모아주세요.";
          }

          showScreen('screen-preview');

          registerAuxTimer(function() {
            var currentTex = window.currentExtractedTexture || currentExtractedTexture || createFallbackDummyTexture();
            initFullButterflyViewer(currentTex);
            if (whiteFlash) whiteFlash.classList.remove('flash-active');
          }, 350);

        }, 1400);
      }, 1000);
    }
  }, intervalDelay);
}

function playCompleteScreenSequence() {
  clearTimeout(completeTypeTimer); clearTimeout(autoTransitionTimer);
  var titleEl = document.getElementById('complete-typing-title');
  var nextGroup = document.getElementById('complete-next-group');
  var btnNext = document.getElementById('btn-complete-next');
  
  if (nextGroup) {
    nextGroup.classList.add('hidden');
    nextGroup.classList.remove('visible');
  }
  if (!titleEl) return;
  
  var rawName = (userSelections.q7_name && userSelections.q7_name.trim()) ? userSelections.q7_name.trim() : "나비";
  var safeName = escapeHtmlSafe(rawName);
  typeWriterText(titleEl, "하늘로 '" + safeName + "'이(가)<br>너울 속으로 날아올랐습니다.<br><br>지금, 스크린을 확인해 보세요.", function() {
    if (btnNext) btnNext.innerHTML = "다음";
    if (nextGroup) {
      nextGroup.classList.remove('hidden');
      nextGroup.classList.add('visible');
    }
  });
}

var btnCompleteNext = document.getElementById('btn-complete-next');
if (btnCompleteNext) {
  btnCompleteNext.onclick = function() {
    transitionToScreenWithFade('screen-share');
  };
}

function playShareScreenSequence() {
  clearTimeout(shareTypeTimer);
  var titleEl = document.getElementById('share-typing-title');
  var bottomDock = document.getElementById('share-bottom-dock');
  if (!titleEl) return;
  if (bottomDock) bottomDock.style.opacity = '0';
  typeWriterText(titleEl, "당신의 나비를 더 멀리 날려보세요.", function() {
    if (bottomDock) bottomDock.style.opacity = '1';
  });
}

// 🌟 글자수 제한 등으로 잘린 이모지(Surrogate Pair)나 깨진 문자를 안전하게 제거하는 헬퍼
function sanitizeShareString(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, function(m) { return m.length > 1 ? m[0] : ''; })
    .replace(/\uFFFD/g, '')
    .trim();
}

// 🌟 HTML 특수문자(<, >, ", ')로 인해 타이핑 파서나 카드 DOM이 깨지는 현상을 방지하는 헬퍼
function escapeHtmlSafe(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 🌟 iOS Safari 등에서 비동기 대기 후 navigator.share가 차단되었을 때 클립보드 복사로 안전하게 이어주는 헬퍼
function triggerShareOrCopyFallback(shareData, shareCardUrl) {
  function copyUrlToClipboard() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareCardUrl).then(function() {
        alert("나비 초대장 링크가 클립보드에 복사되었습니다!");
      }).catch(function() {
        prompt("아래 나비 초대장 링크를 복사해 주세요:", shareCardUrl);
      });
    } else {
      prompt("아래 나비 초대장 링크를 복사해 주세요:", shareCardUrl);
    }
  }

  if (navigator.share) {
    navigator.share(shareData).catch(function(err) {
      // 사용자가 직접 공유창을 닫은 경우(AbortError)가 아니라면 클립보드 복사로 즉시 대체
      if (err && err.name !== 'AbortError') {
        copyUrlToClipboard();
      }
    });
  } else {
    copyUrlToClipboard();
  }
}

var btnActionShare = document.getElementById('btn-action-share');
if (btnActionShare) {
  btnActionShare.onclick = function() {
    var rawName = sanitizeShareString(userSelections.q7_name) || "나비";
    var rawMemo = sanitizeShareString(userSelections.q6_memo) || "너의 찬란한 날갯짓을 응원해.";
    var rawShape = typeof selectedButterflyShape !== 'undefined' && selectedButterflyShape ? selectedButterflyShape : "crescent";
    var rawPattern = typeof selectedPatternId !== 'undefined' && selectedPatternId ? selectedPatternId : (rawShape + "_none");
    var rawAntenna = typeof selectedAntennaType !== 'undefined' && selectedAntennaType ? selectedAntennaType : "ball";
    var rawBodyColor = typeof selectedBodyColor !== 'undefined' && selectedBodyColor ? selectedBodyColor : "blur";
    var encodedAntenna = rawAntenna + (rawBodyColor !== 'white' ? ('__' + rawBodyColor) : '');

    var baseUrl = window.location.href.split('?')[0].replace(/index\.html$/, '');
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    function buildAndShare(resolvedId) {
      var shareCardUrl = '';
      if (resolvedId) {
        shareCardUrl = baseUrl + 'share.html?id=' + encodeURIComponent(resolvedId);
      } else {
        shareCardUrl = baseUrl + 'share.html?name=' + encodeURIComponent(rawName) + 
          '&memo=' + encodeURIComponent(rawMemo) + 
          '&shape=' + encodeURIComponent(rawShape) +
          '&pattern=' + encodeURIComponent(rawPattern) +
          '&antenna=' + encodeURIComponent(encodedAntenna) +
          '&body=' + encodeURIComponent(rawBodyColor);
      }
      var shareData = { text: "당신에게 '" + rawName + "'이(가) 도착했습니다.", url: shareCardUrl };
      triggerShareOrCopyFallback(shareData, shareCardUrl);
    }

    // 🌟 이미 ID가 확보된 상태라면 await 없이 즉시 동기적으로 실행하여 iOS 공유창 차단 방지
    if (lastSavedButterflyId) {
      buildAndShare(lastSavedButterflyId);
      return;
    }

    // 아직 저장이 진행 중일 때만 최대 1.2초 대기 후 실행
    if (currentSavePromise) {
      Promise.race([
        currentSavePromise,
        new Promise(function(resolve) { setTimeout(function() { resolve(null); }, 1200); })
      ]).then(function(savedId) {
        buildAndShare(savedId || lastSavedButterflyId);
      }).catch(function() {
        buildAndShare(lastSavedButterflyId);
      });
    } else {
      buildAndShare(null);
    }
  };
}

var btnActionHome = document.getElementById('btn-action-home');
if (btnActionHome) btnActionHome.onclick = function() { location.reload(); };

function ensureDevDummyData() {
  if (!userSelections.q7_name || userSelections.q7_name.trim().length === 0) {
    userSelections.q7_name = "테스트나비";
    if (inputQ7Name) {
      inputQ7Name.value = "테스트나비";
      if (charCounter) charCounter.innerText = '5/10';
    }
  }
  if (!userSelections.q2 || userSelections.q2.length === 0) {
    userSelections.q2 = ["완벽주의 강박", "비교중독", "수면 부족", "거절 공포", "텅 빈 잔고", "미래 막막함"];
  }
  if (!userSelections.core_concern) {
    userSelections.core_concern = userSelections.q2[0];
  }
  if (!userSelections.concern_reason || userSelections.concern_reason.trim().length === 0) {
    userSelections.concern_reason = "항상 잘 해내야 한다는 마음이 앞서서요.";
    if (inputConcernReason) {
      inputConcernReason.value = userSelections.concern_reason;
      if (concernReasonCounter) concernReasonCounter.innerText = userSelections.concern_reason.length + '/100';
    }
  }
  if (!userSelections.q6_memo || userSelections.q6_memo.trim().length === 0) {
    userSelections.q6_memo = "너의 찬란한 날갯짓을 응원해.";
    if (inputQ6Memo) {
      inputQ6Memo.value = userSelections.q6_memo;
      if (memoCounter) memoCounter.innerText = userSelections.q6_memo.length + '/50';
    }
  }
  
  var currentTex = window.currentExtractedTexture || currentExtractedTexture;
  if (!currentTex) {
    try {
      if (typeof exportAlignedTexture === 'function') {
        exportAlignedTexture();
      } else {
        window.currentExtractedTexture = createFallbackDummyTexture();
        currentExtractedTexture = window.currentExtractedTexture;
      }
    } catch(err) {
      window.currentExtractedTexture = createFallbackDummyTexture();
      currentExtractedTexture = window.currentExtractedTexture;
    }
  }
}

document.addEventListener('click', function(e) {
  var target = e.target;
  if (!target) return;
  var btnNext = target.closest('#dev-btn-skip-next'), btnPrev = target.closest('#dev-btn-skip-prev');

  if (btnNext) {
    e.preventDefault(); e.stopPropagation();
    clearAllTimers();
    if (typeof whiteFlash !== 'undefined' && whiteFlash) whiteFlash.classList.remove('flash-active');
    var wf = document.getElementById('cinematic-white-flash');
    if (wf) wf.classList.remove('flash-active');
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    var curId = (document.querySelector('.screen.active') || {}).id || 'screen-cover';

    if (curId === 'screen-cover' || curId === 'screen-menu') { showScreen('screen-opening'); return; }
    if (curId === 'screen-gallery' || curId === 'screen-intro' || curId === 'screen-guide') { showScreen('screen-menu'); return; }
    if (curId === 'screen-opening') {
      if (openingCurrentStep === 1) {
        openingCurrentStep = 2;
        if (elOpeningCocoonGroup) elOpeningCocoonGroup.classList.remove('hidden');
        if (elOpeningStep3CocoonGroup) elOpeningStep3CocoonGroup.classList.add('hidden');
        if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('visible'); elOpeningNextGroup.classList.add('hidden'); }
        typeWriterText(elOpeningText, "꺼내어 보이지 못한 채,<br>응어리진 무언가... 쉽게 털어놓지 못할 것도 있겠지요.", function() {
          if (btnOpeningNext) btnOpeningNext.innerHTML = "다음";
          if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
        });
        updateDevScreenBadge(); 
        return;
      } else if (openingCurrentStep === 2) {
        openingCurrentStep = 3;
        if (elOpeningCocoonGroup) elOpeningCocoonGroup.classList.add('hidden');
        if (elOpeningStep3CocoonGroup) elOpeningStep3CocoonGroup.classList.remove('hidden');
        if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('visible'); elOpeningNextGroup.classList.add('hidden'); }
        typeWriterText(elOpeningText, "오늘 이곳에서,<br>당신의 마음 깊은 곳에 묻어둔 고치를<br>조심스레 꺼내어보려 합니다.", function() {
          if (btnOpeningNext) btnOpeningNext.innerHTML = "다음";
          if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
        });
        updateDevScreenBadge(); 
        return;
      } else if (openingCurrentStep === 3) { 
        currentStepIdx = 0; 
        showScreen('screen-survey'); 
        return; 
      }
    }
    if (curId === 'screen-survey') {
      if (currentStepIdx === 0) { 
        ensureDevDummyData(); 
        currentStepIdx = 1; 
        renderSurveyStep(); 
        return; 
      }
      else if (currentStepIdx === 1) { 
        ensureDevDummyData(); 
        syncCustomKeywordToQ2();
        showScreen('screen-survey-core-concern'); 
        return; 
      }
      else if (currentStepIdx === 2) { 
        ensureDevDummyData(); 
        showScreen('screen-post-concern-bridge'); 
        return; 
      }
    } else if (curId === 'screen-survey-core-concern') { 
      ensureDevDummyData(); 
      showScreen('screen-survey-concern-reason'); 
      return; 
    } else if (curId === 'screen-survey-concern-reason') { 
      ensureDevDummyData(); 
      showScreen('screen-top7-bridge'); 
      return; 
    } else if (curId === 'screen-top7-bridge') {
      ensureDevDummyData();
      showScreen('screen-survey-concern-top7');
      return;
    } else if (curId === 'screen-survey-concern-top7') { 
      ensureDevDummyData(); 
      currentStepIdx = 2; 
      showScreen('screen-survey'); 
      return; 
    } else if (curId === 'screen-post-concern-bridge') { 
      showScreen('screen-capture-guide'); 
      return; 
    } else if (curId === 'screen-capture-guide') { 
      showScreen('screen-shape-select'); 
      return; 
    } else if (curId === 'screen-shape-select') { 
      ensureDevDummyData(); 
      if (typeof exportAlignedTexture === 'function') exportAlignedTexture(); 
      showScreen('screen-loading'); 
      startAnswerShowcaseSequence(); 
      return; 
    } else if (curId === 'screen-loading') {
      ensureDevDummyData();
      var butterflyName = userSelections.q7_name ? userSelections.q7_name.trim() : "나비";
      var nameHeader = document.getElementById('preview-butterfly-name');
      if (nameHeader) nameHeader.innerText = '‘' + butterflyName + '’';
      var guideText = document.getElementById('preview-guide-text');
      if (guideText) guideText.innerText = userSelections.q6_memo && userSelections.q6_memo.trim().length > 0 
        ? userSelections.q6_memo.trim() : "너의 찬란한 날갯짓을 응원해.";
      
      var flyLabel = document.getElementById('preview-fly-label');
      if (flyLabel) {
        flyLabel.innerHTML = "화면 아무 곳을<br>2초간 길게 눌러 기를 모아주세요.";
      }
      
      showScreen('screen-preview'); 
      var currentTex = window.currentExtractedTexture || currentExtractedTexture || createFallbackDummyTexture();
      initFullButterflyViewer(currentTex);
      return; 
    } else if (curId === 'screen-preview') { 
      ensureDevDummyData(); 
      showScreen('screen-complete'); 
      return; 
    } else if (curId === 'screen-complete') { 
      showScreen('screen-share'); 
      return; 
    } else if (curId === 'screen-share') { 
      showScreen('screen-cover'); 
      return; 
    }
  }

  if (btnPrev) {
    e.preventDefault(); e.stopPropagation();
    clearAllTimers();
    var wfPrev = document.getElementById('cinematic-white-flash');
    if (wfPrev) wfPrev.classList.remove('flash-active');
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    var curId = (document.querySelector('.screen.active') || {}).id || 'screen-cover';

    if (curId === 'screen-cover') { showScreen('screen-share'); return; }
    if (curId === 'screen-menu') { showScreen('screen-cover'); return; }
    if (curId === 'screen-gallery' || curId === 'screen-intro' || curId === 'screen-guide') { showScreen('screen-menu'); return; }
    if (curId === 'screen-opening') {
      if (openingCurrentStep === 3) {
        openingCurrentStep = 2;
        if (elOpeningCocoonGroup) elOpeningCocoonGroup.classList.remove('hidden');
        if (elOpeningStep3CocoonGroup) elOpeningStep3CocoonGroup.classList.add('hidden');
        if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('visible'); elOpeningNextGroup.classList.add('hidden'); }
        typeWriterText(elOpeningText, "꺼내어 보이지 못한 채,<br>응어리진 무언가... 쉽게 털어놓지 못할 것도 있겠지요.", function() {
          if (btnOpeningNext) btnOpeningNext.innerHTML = "다음";
          if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
        });
        updateDevScreenBadge(); 
        return;
      } else if (openingCurrentStep === 2) {
        openingCurrentStep = 1;
        if (elOpeningCocoonGroup) elOpeningCocoonGroup.classList.add('hidden');
        if (elOpeningStep3CocoonGroup) elOpeningStep3CocoonGroup.classList.add('hidden');
        if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('visible'); elOpeningNextGroup.classList.add('hidden'); }
        typeWriterText(elOpeningText, "안녕하세요?<br>지금, 걱정 없는 삶을 살아가고 있나요?", function() {
          if (btnOpeningNext) btnOpeningNext.innerHTML = "다음";
          if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
        });
        updateDevScreenBadge(); 
        return;
      } else if (openingCurrentStep === 1) { 
        showScreen('screen-cover'); 
        return; 
      }
    }
    if (curId === 'screen-survey') {
      if (currentStepIdx === 2) { showScreen('screen-survey-concern-top7'); return; }
      else if (currentStepIdx === 1) { currentStepIdx = 0; renderSurveyStep(); return; }
      else if (currentStepIdx === 0) {
        showScreen('screen-opening'); 
        openingCurrentStep = 3;
        if (elOpeningCocoonGroup) elOpeningCocoonGroup.classList.add('hidden');
        if (elOpeningStep3CocoonGroup) elOpeningStep3CocoonGroup.classList.remove('hidden');
        typeWriterText(elOpeningText, "오늘 이곳에서,<br>당신의 마음 깊은 곳에 묻어둔 고치를<br>조심스레 꺼내어보려 합니다.", function() {
          if (btnOpeningNext) btnOpeningNext.innerHTML = "다음";
          if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
        });
        updateDevScreenBadge(); 
        return;
      }
    } else if (curId === 'screen-survey-core-concern') { 
      removeInjectedCustomFromQ2();
      currentStepIdx = 1;
      showScreen('screen-survey'); 
      return; 
    } else if (curId === 'screen-survey-concern-reason') { 
      showScreen('screen-survey-core-concern'); 
      return; 
    } else if (curId === 'screen-top7-bridge') {
      showScreen('screen-survey-concern-reason');
      return;
    } else if (curId === 'screen-survey-concern-top7') { 
      showScreen('screen-top7-bridge'); 
      return; 
    } else if (curId === 'screen-post-concern-bridge') { 
      currentStepIdx = 2; 
      showScreen('screen-survey'); 
      return; 
    } else if (curId === 'screen-capture-guide') { 
      showScreen('screen-post-concern-bridge'); 
      return; 
    } else if (curId === 'screen-shape-select') { 
      showScreen('screen-capture-guide'); 
      return; 
    } else if (curId === 'screen-loading') { 
      showScreen('screen-shape-select'); 
      return; 
    } else if (curId === 'screen-preview') { 
      showScreen('screen-loading'); 
      startAnswerShowcaseSequence(); 
      return; 
    } else if (curId === 'screen-complete') { 
      ensureDevDummyData(); 
      showScreen('screen-preview'); 
      var currentTex = window.currentExtractedTexture || currentExtractedTexture || createFallbackDummyTexture();
      initFullButterflyViewer(currentTex); 
      return; 
    } else if (curId === 'screen-share') { 
      showScreen('screen-complete'); 
      return; 
    }
  }
}, true);

function bindAppNavEvents() {
  var binds = [
    ['btn-start-cover', function() { showScreen('screen-menu'); }],
    ['btn-menu-back', function() { showScreen('screen-cover'); }],
    ['menu-btn-create', function() { transitionToOpeningDramatic(); }],
    ['menu-btn-browse', function() { transitionToScreenWithFade('screen-gallery'); }],
    ['btn-gallery-back', function() { transitionToScreenWithFade('screen-menu'); }],
    ['menu-btn-intro', function() { transitionToScreenWithFade('screen-intro'); }],
    ['btn-intro-back', function() { showScreen('screen-menu'); }],
    ['menu-btn-guide', function() { transitionToScreenWithFade('screen-guide'); }],
    ['btn-guide-back', function() { showScreen('screen-menu'); }]
  ];
  binds.forEach(function(item) {
    var el = document.getElementById(item[0]);
    if (el) el.onclick = item[1];
  });
}
bindAppNavEvents();

var openingCurrentStep = 1;
var elOpeningText = document.getElementById('opening-text');
var elOpeningChoiceGroup = document.getElementById('opening-choice-group');
var elOpeningNextGroup = document.getElementById('opening-next-group');
var btnOpeningNext = document.getElementById('btn-opening-next');
var elOpeningCocoonGroup = document.getElementById('opening-cocoon-group');
var elOpeningStep3CocoonGroup = document.getElementById('opening-step3-cocoon-group');

function typeWriterText(targetElement, textWithHtml, onComplete) {
  clearTimeout(typeTimer);
  if (!targetElement) return;
  targetElement.innerHTML = "";
  var tokens = textWithHtml.match(/(<[^>]+>|[^<])/g) || [];
  var idx = 0, currentContent = "";

  (function nextChar() {
    if (idx < tokens.length) {
      var char = tokens[idx];
      currentContent += char;
      targetElement.innerHTML = currentContent;
      idx++;
      var delay = 85;
      if (char.startsWith('<')) delay = 0;
      else if (char === '?' || char === '.') delay = 450;
      else if (char === ',') delay = 250;
      typeTimer = setTimeout(nextChar, delay);
    } else {
      registerAuxTimer(function() { if (onComplete) onComplete(); }, 200);
    }
  })();
}

function resetOpeningFlow() {
  clearTimeout(typeTimer); clearTimeout(openingDelayTimer);
  openingCurrentStep = 1;
  currentStepIdx = 0;

  // 🌟 새로운 나비 만들기 진입 시 이전 관람객의 설문 데이터 및 사진/커스텀 상태 완전 초기화
  userSelections = { q1: [], q2: [], q1_custom: "", q2_custom: "", core_concern: "", concern_reason: "", q6_memo: "", q7_name: "" };
  lastInjectedCustomKeyword = "";
  if (typeof inputQ7Name !== 'undefined' && inputQ7Name) inputQ7Name.value = "";
  if (typeof charCounter !== 'undefined' && charCounter) charCounter.innerText = "0/10";
  if (typeof inputQ6Memo !== 'undefined' && inputQ6Memo) inputQ6Memo.value = "";
  if (typeof memoCounter !== 'undefined' && memoCounter) memoCounter.innerText = "0/50";
  if (typeof inputCustomKeyword !== 'undefined' && inputCustomKeyword) inputCustomKeyword.value = "";
  if (typeof btnCustomKeywordClear !== 'undefined' && btnCustomKeywordClear) btnCustomKeywordClear.classList.add('hidden');
  if (typeof inputConcernReason !== 'undefined' && inputConcernReason) inputConcernReason.value = "";
  if (typeof concernReasonCounter !== 'undefined' && concernReasonCounter) concernReasonCounter.innerText = "0/100";

  window.currentExtractedTexture = null;
  currentExtractedTexture = null;
  window.currentSelected3DPatternPath = null;
  if (typeof currentSelected3DPatternPath !== 'undefined') currentSelected3DPatternPath = null;
  if (typeof rawImage !== 'undefined') rawImage = new Image();
  if (typeof selectedButterflyShape !== 'undefined') selectedButterflyShape = 'crescent';
  if (typeof selectedAntennaType !== 'undefined') selectedAntennaType = 'ball';
  if (typeof selectedPatternId !== 'undefined') selectedPatternId = 'crescent_none';
  if (typeof selectedBodyColor !== 'undefined') selectedBodyColor = 'blur';
  if (typeof currentBlurPx !== 'undefined') currentBlurPx = 0;
  if (typeof isSymmetryEnabled !== 'undefined') isSymmetryEnabled = false;

  if (elOpeningCocoonGroup) { elOpeningCocoonGroup.classList.add('hidden'); }
  if (elOpeningStep3CocoonGroup) { elOpeningStep3CocoonGroup.classList.add('hidden'); }
  if (elOpeningText) elOpeningText.innerHTML = "";
  if (elOpeningChoiceGroup) { elOpeningChoiceGroup.classList.remove('visible'); elOpeningChoiceGroup.classList.add('hidden'); }
  if (elOpeningNextGroup) { elOpeningNextGroup.classList.add('hidden'); elOpeningNextGroup.classList.remove('visible'); }

  // 🌟 페이지가 넘어가는 연출이 끝나는 즉시(2초 대기 없이 바로) 타이핑이 시작되도록 수정
  typeWriterText(elOpeningText, "안녕하세요?<br>지금, 걱정 없는 삶을 살아가고 있나요?", function() {
    if (btnOpeningNext) btnOpeningNext.innerHTML = "다음";
    if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
  });
}

if (btnOpeningNext) {
  btnOpeningNext.onclick = function() {
    if (openingCurrentStep === 1) {
      openingCurrentStep = 2;
      // 🌟 [수정]: 2단계에서는 사람 이미지만 보이고 고치 이미지는 확실히 숨깁니다.
      if (elOpeningCocoonGroup) { elOpeningCocoonGroup.classList.remove('hidden'); }
      if (elOpeningStep3CocoonGroup) { elOpeningStep3CocoonGroup.classList.add('hidden'); }
      if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('visible'); elOpeningNextGroup.classList.add('hidden'); }
      typeWriterText(elOpeningText, "꺼내어 보이지 못한 채,<br>응어리진 무언가... 쉽게 털어놓지 못할 것도 있겠지요.", function() {
        btnOpeningNext.innerHTML = "다음";
        if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
      });
      updateDevScreenBadge();
    } else if (openingCurrentStep === 2) {
      openingCurrentStep = 3;
      // 🌟 3단계에서는 사람 이미지를 숨기고 고치 이미지만 표시합니다.
      if (elOpeningCocoonGroup) { elOpeningCocoonGroup.classList.add('hidden'); }
      if (elOpeningStep3CocoonGroup) { elOpeningStep3CocoonGroup.classList.remove('hidden'); }
      if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('visible'); elOpeningNextGroup.classList.add('hidden'); }
      typeWriterText(elOpeningText, "오늘 이곳에서,<br>당신의 마음 깊은 곳에 묻어둔 고치를<br>조심스레 꺼내어보려 합니다.", function() {
        btnOpeningNext.innerHTML = "다음";
        if (elOpeningNextGroup) { elOpeningNextGroup.classList.remove('hidden'); elOpeningNextGroup.classList.add('visible'); }
      });
      updateDevScreenBadge();
    } else if (openingCurrentStep === 3) {
      currentStepIdx = 0;
      showScreen('screen-survey');
    }
  };
}

function initTop7BridgeScreen() {
  clearTimeout(top7BridgeTypeTimer);
  var textEl = document.getElementById('top7-bridge-text');
  var nextGroup = document.getElementById('top7-bridge-next-group');
  var btnNext = document.getElementById('btn-top7-bridge-next');

  if (!textEl || !nextGroup) return;
  textEl.innerHTML = "";
  nextGroup.classList.add('hidden');
  nextGroup.classList.remove('visible');

  typeWriterText(textEl, "그렇군요.<br>다른 사람들은 어떤 것을 선택했을까요?", function() {
    if (btnNext) btnNext.innerHTML = "다음";
    nextGroup.classList.remove('hidden');
    nextGroup.classList.add('visible');
  });
}

var btnTop7BridgeNext = document.getElementById('btn-top7-bridge-next');
if (btnTop7BridgeNext) {
  btnTop7BridgeNext.onclick = function() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        DeviceOrientationEvent.requestPermission().catch(function() {});
      } catch (e) {}
    }
    showScreen('screen-survey-concern-top7');
  };
}

function initConcernReasonScreen() {
  clearTimeout(reasonTypeTimer);
  var pickedKeyword = userSelections.core_concern || "완벽주의 강박";
  if (elConcernReasonKeywordDisplay) elConcernReasonKeywordDisplay.innerText = pickedKeyword;
  if (elConcernReasonTitle) elConcernReasonTitle.innerHTML = "";

  var tokens = "이것을 선택한 이유는 무엇인가요?".match(/(<[^>]+>|[^<])/g) || [];
  var idx = 0, cur = "";
  (function typeReasonChar() {
    if (idx < tokens.length) {
      var char = tokens[idx]; cur += char;
      if (elConcernReasonTitle) elConcernReasonTitle.innerHTML = cur;
      idx++;
      reasonTypeTimer = setTimeout(typeReasonChar, char.startsWith('<') ? 0 : (char === '?' || char === '.' ? 320 : 70));
    } else {
      registerAuxTimer(function() {
        if (elConcernReasonKeywordDisplay) elConcernReasonKeywordDisplay.style.opacity = '1';
      }, 200);
    }
  })();

  if (inputConcernReason) {
    inputConcernReason.value = userSelections.concern_reason || "";
    if (concernReasonCounter) concernReasonCounter.innerText = (userSelections.concern_reason ? userSelections.concern_reason.length : 0) + '/100';
  }
  validateConcernReasonStep();
}

function initPostConcernBridgeScreen() {
  clearTimeout(postConcernTypeTimer);
  var textEl = document.getElementById('post-concern-bridge-text');
  var nextGroup = document.getElementById('post-concern-bridge-next-group');
  var btnNext = document.getElementById('btn-post-concern-bridge-next');
  var butterflyImgGroup = document.getElementById('post-concern-butterfly-group');

  if (!textEl || !nextGroup) return;
  textEl.innerHTML = "";
  nextGroup.classList.add('hidden');
  nextGroup.classList.remove('visible');

  if (butterflyImgGroup) {
    butterflyImgGroup.classList.remove('hidden');
    butterflyImgGroup.style.display = 'flex';
  }

  typeWriterText(textEl, "당신에 대해 잘 알게 됐어요.<br>이제 그 마음을 나비로 만들어 볼게요.", function() {
    if (btnNext) btnNext.innerHTML = "다음";
    nextGroup.classList.remove('hidden');
    nextGroup.classList.add('visible');
  });
}

var btnPostConcernBridgeNext = document.getElementById('btn-post-concern-bridge-next');
if (btnPostConcernBridgeNext) {
  btnPostConcernBridgeNext.onclick = function() { showScreen('screen-capture-guide'); };
}

function playBridgeTypingSequence() {
  var textEl = document.getElementById('bridge-typing-text');
  var nextGroup = document.getElementById('bridge-next-group');
  var btnNext = document.getElementById('btn-goto-stats');
  if (!textEl || !nextGroup) return;
  textEl.innerHTML = "";
  nextGroup.classList.add('hidden');
  nextGroup.classList.remove('visible');

  typeWriterText(textEl, "당신이 남긴 따뜻한 조각들이<br>작은 빛이 되어 나비에게 스며듭니다.", function() {
    if (btnNext) btnNext.innerHTML = "다음";
    nextGroup.classList.remove('hidden');
    nextGroup.classList.add('visible');
  });
}

var btnGotoStats = document.getElementById('btn-goto-stats');
if (btnGotoStats) {
  btnGotoStats.onclick = function() { showScreen('screen-loading'); };
}

var guideTitleWrap = document.querySelector('.guide-title-wrapper');
var guideAnimatedTitle = document.getElementById('guide-animated-title');
var guideCenterCard = document.getElementById('guide-center-card');
var guideBottomDock = document.getElementById('guide-bottom-dock');

function startCaptureGuideCinematicFlow() {
  clearTimeout(guideTypeTimer);
  var introMessage = "고치에서 깨어날 당신의 나비는<br>어떤 모습인가요?";

  // 🌟 이미 한 번 연출을 본 뒤 '다시 촬영' 등으로 돌아온 경우 애니메이션 없이 즉시 전체 페이지 표시
  if (hasSeenCaptureGuideAnimation) {
    if (guideAnimatedTitle) guideAnimatedTitle.innerHTML = introMessage;
    if (guideTitleWrap) guideTitleWrap.classList.add('moved-to-top');
    if (guideCenterCard) guideCenterCard.classList.add('revealed');
    if (guideBottomDock) guideBottomDock.classList.add('revealed');
    return;
  }

  hasSeenCaptureGuideAnimation = true;
  if (guideTitleWrap) guideTitleWrap.classList.remove('moved-to-top');
  if (guideAnimatedTitle) guideAnimatedTitle.innerHTML = "";
  if (guideCenterCard) guideCenterCard.classList.remove('revealed');
  if (guideBottomDock) guideBottomDock.classList.remove('revealed');

  var tokens = introMessage.match(/(<[^>]+>|[^<])/g) || [];
  var idx = 0, curText = "";

  (function typeNext() {
    if (idx < tokens.length) {
      var char = tokens[idx];
      curText += char;
      if (guideAnimatedTitle) guideAnimatedTitle.innerHTML = curText;
      idx++;
      var delay = (char.startsWith('<') ? 0 : (char === '?' || char === '.' ? 400 : 80));
      guideTypeTimer = setTimeout(typeNext, delay);
    } else {
      registerAuxTimer(function() {
        if (guideTitleWrap) guideTitleWrap.classList.add('moved-to-top');
        registerAuxTimer(function() {
          if (guideCenterCard) guideCenterCard.classList.add('revealed');
          if (guideBottomDock) guideBottomDock.classList.add('revealed');
        }, 450);
      }, 350);
    }
  })();
}

var SUPABASE_URL = 'https://djmdzsbfsobsutphragw.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbWR6c2Jmc29ic3V0cGhyYWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODQ3NTgsImV4cCI6MjEwNTQ2MDc1OH0.BC7llaSjbq6cYhDlRqrwJaycpQ6gSNcp5LgYBeM6WEM';
var _supabaseClientInstance = null;

function getSupabaseClient() {
  if (_supabaseClientInstance) return _supabaseClientInstance;
  
  var factory = null;
  var sbLib = window.supabase || window.Supabase || window.supabaseJs;

  if (sbLib && typeof sbLib.createClient === 'function') {
    factory = sbLib.createClient;
  } else if (typeof window.createClient === 'function') {
    factory = window.createClient;
  }

  if (factory) {
    try {
      _supabaseClientInstance = factory(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn("Supabase 클라이언트 생성 재시도 실패:", e);
    }
  }
  return _supabaseClientInstance;
}

var elTitle = document.getElementById('question-title');
var elDesc = document.getElementById('question-desc');
var elProgressBar = document.getElementById('progress-bar');
var surveyChipWrapper = document.getElementById('survey-chip-wrapper');
var elOrganicContainer = document.getElementById('organic-chip-container');
var elField6 = document.getElementById('field-step-6');
var elField7 = document.getElementById('field-step-7');
var btnSurveyNext = document.getElementById('btn-survey-next');
var btnSurveyPrev = document.getElementById('btn-survey-prev');
var inputQ6Memo = document.getElementById('input-q6-memo');
var memoCounter = document.getElementById('memo-counter');
var inputQ7Name = document.getElementById('input-q7-name');
var charCounter = document.getElementById('char-counter');
var elSelectedConcernChips = document.getElementById('selected-concern-chips');
var surveyCustomInputAnchor = document.getElementById('survey-custom-input-anchor');
var inputCustomKeyword = document.getElementById('input-custom-keyword');
var btnCustomKeywordClear = document.getElementById('btn-custom-keyword-clear');

function typeWriterSurveyTitle(titleHtml, onComplete) {
  clearTimeout(surveyTitleTypeTimer);
  if (!elTitle) return;
  elTitle.innerHTML = "";
  var tokens = titleHtml.match(/(<[^>]+>|[^<])/g) || [];
  var idx = 0, currentContent = "";

  (function nextChar() {
    if (idx < tokens.length) {
      var char = tokens[idx];
      currentContent += char;
      elTitle.innerHTML = currentContent;
      idx++;
      var delay = (char.startsWith('<') ? 0 : (char === '?' || char === '.' ? 350 : 80));
      surveyTitleTypeTimer = setTimeout(nextChar, delay);
    } else if (onComplete) registerAuxTimer(onComplete, 150);
  })();
}

function updateCustomInputBarState() {
  if (!inputCustomKeyword) return;
  var currentCustom = (currentStepIdx === 1) ? (userSelections.q2_custom || "") : "";
  inputCustomKeyword.value = currentCustom;
  if (btnCustomKeywordClear) btnCustomKeywordClear.classList.toggle('hidden', currentCustom.trim().length === 0);
}

function renderSurveyStep() {
  var q = surveyQuestions[currentStepIdx];
  if (!q) return;

  if (elProgressBar) elProgressBar.style.width = (currentStepIdx === 0 ? 25 : (currentStepIdx === 1 ? 50 : 90)) + '%';
  if (btnSurveyPrev) btnSurveyPrev.classList.toggle('invisible', currentStepIdx === 0);
  if (btnSurveyNext) btnSurveyNext.innerText = (currentStepIdx === 2) ? "다음으로" : "다음 질문으로";

  var titleBox = document.querySelector('.survey-title-box');
  if (titleBox) titleBox.style.display = 'flex';

  if (currentStepIdx === 0) {
    stopBubblePhysics(); typeWriterSurveyTitle(q.title);
    if (elDesc) elDesc.innerHTML = q.desc;
    if (surveyChipWrapper) surveyChipWrapper.classList.add('hidden');
    if (elField6) { elField6.classList.add('hidden'); elField6.classList.remove('flex'); }
    if (elField7) { elField7.classList.remove('hidden'); elField7.classList.add('flex'); }
    if (surveyCustomInputAnchor) { surveyCustomInputAnchor.classList.remove('custom-anchor-visible'); surveyCustomInputAnchor.classList.add('custom-anchor-hidden'); }
    if (inputQ7Name) {
      inputQ7Name.value = userSelections.q7_name || "";
      if (charCounter) charCounter.innerText = (userSelections.q7_name ? userSelections.q7_name.length : 0) + '/10';
    }
  } else if (currentStepIdx === 1) {
    removeInjectedCustomFromQ2();
    stopBubblePhysics(); typeWriterSurveyTitle(q.title);
    if (elDesc) elDesc.innerHTML = q.desc;
    if (surveyChipWrapper) surveyChipWrapper.classList.remove('hidden');
    if (elField6) { elField6.classList.add('hidden'); elField6.classList.remove('flex'); }
    if (elField7) { elField7.classList.add('hidden'); elField7.classList.remove('flex'); }
    if (surveyCustomInputAnchor) { surveyCustomInputAnchor.classList.remove('custom-anchor-hidden'); surveyCustomInputAnchor.classList.add('custom-anchor-visible'); }
    updateCustomInputBarState(); renderVerticalScrollChips();
  } else if (currentStepIdx === 2) {
    typeWriterSurveyTitle(q.title);
    if (elDesc) elDesc.innerHTML = q.desc;
    if (surveyChipWrapper) surveyChipWrapper.classList.add('hidden');
    if (elField7) { elField7.classList.add('hidden'); elField7.classList.remove('flex'); }
    if (surveyCustomInputAnchor) { surveyCustomInputAnchor.classList.remove('custom-anchor-visible'); surveyCustomInputAnchor.classList.add('custom-anchor-hidden'); }
    if (elField6) { elField6.classList.remove('hidden'); elField6.classList.add('flex'); }
    if (inputQ6Memo) {
      inputQ6Memo.value = userSelections.q6_memo || "";
      if (memoCounter) memoCounter.innerText = (userSelections.q6_memo ? userSelections.q6_memo.length : 0) + '/50';
    }

    var memoBox = elField6 ? elField6.querySelector('.glass-input-card-v2') : null;
    var memoCounterWrap = memoCounter ? memoCounter.parentElement : null;
    if (memoBox) { memoBox.style.opacity = '1'; memoBox.style.transform = 'translateY(0)'; }
    if (memoCounterWrap) memoCounterWrap.style.opacity = '1';
    if (elSelectedConcernChips) { elSelectedConcernChips.innerHTML = ''; elSelectedConcernChips.style.display = 'none'; }
    startBubblePhysics();
  }
  validateSurveyStep();
  updateDevScreenBadge();
}

function updateChipStyle(chip, isSelected) {
  chip.classList.toggle('chip-selected', isSelected);
  chip.classList.toggle('chip-unselected', !isSelected);
  if (isSelected) {
    chip.style.setProperty('background-color', '#ffffff', 'important');
    chip.style.setProperty('background-image', 'linear-gradient(180deg, #ffffff 0%, #ffffff 100%)', 'important');
    chip.style.setProperty('border', 'none', 'important');
    chip.style.setProperty('color', '#000000', 'important');
    chip.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
    chip.style.setProperty('font-weight', '700', 'important');
    chip.style.setProperty('box-shadow', '0 0 18px 2px rgba(255, 255, 255, 0.5)', 'important');
  } else {
    chip.style.setProperty('background', 'rgba(255, 255, 255, 0.08)', 'important');
    chip.style.setProperty('background-image', 'none', 'important');
    chip.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.14)', 'important');
    chip.style.setProperty('color', '#a3a3a3', 'important');
    chip.style.setProperty('-webkit-text-fill-color', '#a3a3a3', 'important');
    chip.style.setProperty('font-weight', '500', 'important');
    chip.style.setProperty('box-shadow', 'none', 'important');
  }
}

function renderVerticalScrollChips() {
  if (!elOrganicContainer || !surveyChipWrapper) return;
  var rows = buildAdaptiveVerticalRows(surveyQuestions[currentStepIdx].options || []);
  elOrganicContainer.innerHTML = ''; surveyChipWrapper.scrollTop = 0;

  rows.forEach(function(rowItems) {
    var rowDiv = document.createElement('div');
    rowDiv.className = 'flex items-center justify-center gap-1.5 w-full';
    rowItems.forEach(function(item) {
      var chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip-base'; chip.innerText = item;
      var isSelected = userSelections.q2.indexOf(item) > -1;
      updateChipStyle(chip, isSelected);

      chip.onclick = function() {
        var idx = userSelections.q2.indexOf(item);
        if (idx > -1) userSelections.q2.splice(idx, 1);
        else userSelections.q2.push(item);
        updateChipStyle(chip, userSelections.q2.indexOf(item) > -1);
        validateSurveyStep();
      };
      rowDiv.appendChild(chip);
    });
    elOrganicContainer.appendChild(rowDiv);
  });
}

if (inputCustomKeyword) {
  inputCustomKeyword.oninput = function(e) {
    var val = e.target.value;
    if (currentStepIdx === 1) userSelections.q2_custom = val;
    if (btnCustomKeywordClear) btnCustomKeywordClear.classList.toggle('hidden', val.trim().length === 0);
    validateSurveyStep();
  };
}

if (btnCustomKeywordClear) {
  btnCustomKeywordClear.onclick = function(e) {
    e.stopPropagation();
    if (inputCustomKeyword) { inputCustomKeyword.value = ""; inputCustomKeyword.focus(); }
    if (currentStepIdx === 1) {
      removeInjectedCustomFromQ2();
      userSelections.q2_custom = "";
    }
    btnCustomKeywordClear.classList.add('hidden');
    validateSurveyStep();
  };
}

function validateSurveyStep() {
  if (!btnSurveyNext) return;
  var isValid = false;
  if (currentStepIdx === 0) {
    isValid = !!(userSelections.q7_name && userSelections.q7_name.trim().length > 0);
  } else if (currentStepIdx === 1) {
    isValid = (userSelections.q2 && userSelections.q2.length > 0) || (userSelections.q2_custom && userSelections.q2_custom.trim().length > 0);
  } else if (currentStepIdx === 2) {
    isValid = !!(userSelections.q6_memo && userSelections.q6_memo.trim().length > 0);
  }
  btnSurveyNext.disabled = !isValid;
  btnSurveyNext.style.pointerEvents = isValid ? 'auto' : 'none';
}

if (inputQ6Memo) {
  inputQ6Memo.oninput = function(e) {
    userSelections.q6_memo = e.target.value;
    if (memoCounter) memoCounter.innerText = e.target.value.length + '/50';
    validateSurveyStep();
  };
}

if (inputQ7Name) {
  inputQ7Name.oninput = function(e) {
    userSelections.q7_name = e.target.value;
    if (charCounter) charCounter.innerText = e.target.value.length + '/10';
    validateSurveyStep();
  };
}

if (btnSurveyNext) {
  btnSurveyNext.onclick = function() {
    if (currentStepIdx === 0) { 
      currentStepIdx = 1; 
      renderSurveyStep(); 
    } else if (currentStepIdx === 1) {
      syncCustomKeywordToQ2();
      showScreen('screen-survey-core-concern'); 
    } else if (currentStepIdx === 2) {
      showScreen('screen-post-concern-bridge'); 
    }
  };
}

if (btnSurveyPrev) {
  btnSurveyPrev.onclick = function() {
    if (currentStepIdx === 2) showScreen('screen-survey-concern-top7');
    else if (currentStepIdx === 1) { currentStepIdx = 0; renderSurveyStep(); }
  };
}

var elCoreConcernTitleWrap = document.getElementById('core-concern-title-wrapper');
var elCoreConcernTitle = document.getElementById('core-concern-title');
var elCoreConcernSubGuide = document.getElementById('core-concern-sub-guide');
var elCoreConcernContainer = document.getElementById('core-concern-scroll-container');
var elCoreConcernGrid = document.getElementById('core-concern-scroll-grid');
var btnCoreConcernNext = document.getElementById('btn-core-concern-next');
var btnCoreConcernPrev = document.getElementById('btn-core-concern-prev');

var coreConcernIsMouseDown = false;
var coreConcernStartXCoord = 0;
var coreConcernScrollLeftVal = 0;

window.addEventListener('mouseup', function() {
  coreConcernIsMouseDown = false;
});

function initCoreConcernScreen() {
  clearTimeout(coreConcernTypeTimer);
  coreConcernIsMouseDown = false;
  if (elCoreConcernTitleWrap) elCoreConcernTitleWrap.classList.remove('moved-to-top');
  if (elCoreConcernTitle) elCoreConcernTitle.innerHTML = "";
  if (elCoreConcernSubGuide) elCoreConcernSubGuide.style.opacity = '0';
  if (elCoreConcernContainer) elCoreConcernContainer.classList.remove('revealed');

  var selectedItems = [].concat(userSelections.q2 || []);
  if (userSelections.q2_custom && userSelections.q2_custom.trim()) {
    var cCustom = userSelections.q2_custom.trim();
    if (selectedItems.indexOf(cCustom) === -1) selectedItems.unshift(cCustom);
  }

  if (selectedItems.indexOf(userSelections.core_concern) === -1) {
    userSelections.core_concern = "";
  }
  
  if (btnCoreConcernNext) {
    btnCoreConcernNext.innerText = "다음으로";
    btnCoreConcernNext.disabled = !userSelections.core_concern;
    btnCoreConcernNext.style.pointerEvents = userSelections.core_concern ? 'auto' : 'none';
  }
  if (elCoreConcernGrid) elCoreConcernGrid.innerHTML = '';

  var distribution = calculateRowDistribution(selectedItems.length), itemCursor = 0;
  distribution.forEach(function(countInRow) {
    var rowDiv = document.createElement('div');
    rowDiv.className = 'core-concern-row';
    for (var i = 0; i < countInRow && itemCursor < selectedItems.length; i++) {
      (function() {
        var item = selectedItems[itemCursor];
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'core-concern-text-btn'; btn.innerText = item;
        btn.classList.add(userSelections.core_concern === item ? 'core-concern-selected' : 'core-concern-unselected');

        btn.onclick = function() {
          userSelections.core_concern = item;
          elCoreConcernGrid.querySelectorAll('.core-concern-text-btn').forEach(function(b) {
            b.classList.remove('core-concern-selected'); b.classList.add('core-concern-unselected');
          });
          btn.classList.remove('core-concern-unselected'); btn.classList.add('core-concern-selected');
          if (btnCoreConcernNext) {
            btnCoreConcernNext.innerText = "다음으로";
            btnCoreConcernNext.disabled = false;
            btnCoreConcernNext.style.pointerEvents = 'auto';
          }
        };
        rowDiv.appendChild(btn); itemCursor++;
      })();
    }
    elCoreConcernGrid.appendChild(rowDiv);
  });

  if (elCoreConcernContainer) {
    registerAuxTimer(function() {
      elCoreConcernContainer.scrollLeft = Math.max(0, (elCoreConcernContainer.scrollWidth - elCoreConcernContainer.clientWidth) / 2);
    }, 50);

    elCoreConcernContainer.onmousedown = function(e) {
      coreConcernIsMouseDown = true;
      coreConcernStartXCoord = e.pageX - elCoreConcernContainer.offsetLeft;
      coreConcernScrollLeftVal = elCoreConcernContainer.scrollLeft;
    };
    elCoreConcernContainer.onmouseleave = function() { coreConcernIsMouseDown = false; };
    elCoreConcernContainer.onmouseup = function() { coreConcernIsMouseDown = false; };
    elCoreConcernContainer.onmousemove = function(e) {
      if (!coreConcernIsMouseDown) return;
      e.preventDefault();
      elCoreConcernContainer.scrollLeft = coreConcernScrollLeftVal - ((e.pageX - elCoreConcernContainer.offsetLeft) - coreConcernStartXCoord) * 1.5;
    };
  }

  var tokens = "가장 꺼내기 힘든 것은<br>무엇인가요?".match(/(<[^>]+>|[^<])/g) || [];
  var idx = 0, curText = "";
  (function typeNextCoreChar() {
    if (idx < tokens.length) {
      var char = tokens[idx]; curText += char;
      if (elCoreConcernTitle) elCoreConcernTitle.innerHTML = curText;
      idx++;
      coreConcernTypeTimer = setTimeout(typeNextCoreChar, char.startsWith('<') ? 0 : (char === '?' || char === '.' ? 350 : 75));
    } else {
      registerAuxTimer(function() {
        if (elCoreConcernTitleWrap) elCoreConcernTitleWrap.classList.add('moved-to-top');
        registerAuxTimer(function() { 
          if (elCoreConcernSubGuide) elCoreConcernSubGuide.style.opacity = '1';
          if (elCoreConcernContainer) elCoreConcernContainer.classList.add('revealed'); 
        }, 450);
      }, 350);
    }
  })();
}

if (btnCoreConcernNext) btnCoreConcernNext.onclick = function() { if (userSelections.core_concern) showScreen('screen-survey-concern-reason'); };
if (btnCoreConcernPrev) btnCoreConcernPrev.onclick = function() { 
  removeInjectedCustomFromQ2();
  currentStepIdx = 1;
  showScreen('screen-survey'); 
};

var elConcernReasonTitle = document.getElementById('concern-reason-title');
var inputConcernReason = document.getElementById('input-concern-reason');
var concernReasonCounter = document.getElementById('concern-reason-counter');
var btnConcernReasonNext = document.getElementById('btn-concern-reason-next');
var btnConcernReasonPrev = document.getElementById('btn-concern-reason-prev');
var elConcernReasonKeywordDisplay = document.getElementById('concern-reason-picked-keyword-display');

function validateConcernReasonStep() {
  if (!btnConcernReasonNext) return;
  var isValid = !!(userSelections.concern_reason && userSelections.concern_reason.trim().length > 0);
  btnConcernReasonNext.disabled = !isValid;
  btnConcernReasonNext.style.pointerEvents = isValid ? 'auto' : 'none';
}

if (inputConcernReason) {
  inputConcernReason.oninput = function(e) {
    userSelections.concern_reason = e.target.value;
    if (concernReasonCounter) concernReasonCounter.innerText = e.target.value.length + '/100';
    validateConcernReasonStep();
  };
}

if (btnConcernReasonNext) {
  btnConcernReasonNext.onclick = function() { 
    if (userSelections.concern_reason && userSelections.concern_reason.trim().length > 0) {
      showScreen('screen-top7-bridge'); 
    }
  };
}
if (btnConcernReasonPrev) {
  btnConcernReasonPrev.onclick = function() { showScreen('screen-survey-core-concern'); };
}

// 🌟 [실제 데이터 집계]: Supabase butterflies 테이블 및 현재 유저 q2 선택 항목 취합 후 상위 n개(최대 5개) 동적 생성
async function fetchTopKeywordsData() {
  try {
    var client = getSupabaseClient();
    var freqMap = {};
    var totalCount = 0;

    // 1. 현재 세션 사용자가 고른 q2 고민 먼저 반영
    var currentSelections = [].concat(userSelections.q2 || []);
    if (userSelections.q2_custom && userSelections.q2_custom.trim()) {
      var c = userSelections.q2_custom.trim();
      if (currentSelections.indexOf(c) === -1) currentSelections.push(c);
    }
    currentSelections.forEach(function(k) {
      if (!k) return;
      freqMap[k] = (freqMap[k] || 0) + 1;
      totalCount++;
    });

    // 2. Supabase DB에서 누적된 사용자의 q2 데이터 취합
    if (client) {
      var { data, error } = await client.from('butterflies').select('q2').order('id', { ascending: false }).limit(500);
      if (!error && Array.isArray(data)) {
        data.forEach(function(row) {
          if (Array.isArray(row.q2)) {
            row.q2.forEach(function(k) {
              if (!k) return;
              freqMap[k] = (freqMap[k] || 0) + 1;
              totalCount++;
            });
          }
        });
      }
    }

    var sortedKeywords = Object.keys(freqMap).map(function(k) {
      return { keyword: k, count: freqMap[k] };
    }).sort(function(a, b) {
      return b.count - a.count;
    });

    // 데이터가 아예 없을 경우 기존 폴백 반환
    if (sortedKeywords.length === 0 || totalCount === 0) {
      return top7KeywordData;
    }

    // 🌟 [동적 개수 생성]: 데이터가 5개 미만이면 존재하는 개수만큼만, 5개 이상이면 상위 5개만 추출
    var targetCount = Math.min(5, sortedKeywords.length);
    var resultList = [];

    for (var i = 0; i < targetCount; i++) {
      var item = sortedKeywords[i];
      var tmpl = top7StyleTemplate[i] || top7StyleTemplate[top7StyleTemplate.length - 1];
      var pct = ((item.count / totalCount) * 100).toFixed(1) + "%";

      resultList.push({
        rank: i + 1,
        keyword: item.keyword,
        percent: pct,
        radius: tmpl.radius,
        fill: tmpl.fill,
        textColor: tmpl.textColor,
        subColor: tmpl.subColor
      });
    }

    return resultList;
  } catch (err) {
    console.warn("키워드 집계 중 오류 발생, 기본값 사용:", err);
    return top7KeywordData;
  }
}

function updateTop7PickedSubtitle() {
  var subtitleEl = document.getElementById('top7-user-picked-subtitle');
  if (subtitleEl) {
    var pickedKeyword = userSelections.core_concern || "완벽주의 강박";
    subtitleEl.innerText = "당신이 고른 키워드 : " + pickedKeyword;
  }
}

var btnConcernTop7Next = document.getElementById('btn-concern-top7-next');
if (btnConcernTop7Next) {
  btnConcernTop7Next.onclick = function() {
    currentStepIdx = 2;
    showScreen('screen-survey');
  };
}

var btnConcernTop7Prev = document.getElementById('btn-concern-top7-prev');
if (btnConcernTop7Prev) {
  btnConcernTop7Prev.onclick = function() {
    showScreen('screen-top7-bridge');
  };
}

window.saveButterflyToSupabase = function() {
  if (currentSavePromise) return currentSavePromise;

  currentSavePromise = (async function() {
    try {
      var client = getSupabaseClient();
      
      // 클라이언트가 준비될 때까지 최대 15회(약 4.5초) 대기 시도
      if (!client) {
        for (var attempt = 0; attempt < 15; attempt++) {
          await new Promise(function(resolve) { setTimeout(resolve, 300); });
          client = getSupabaseClient();
          if (client) break;
        }
      }

      if (!client) {
        console.error("❌ Supabase 클라이언트가 초기화되지 않았습니다. window.supabase를 확인해주세요.");
        return null;
      }

      var rawTex = window.currentExtractedTexture || currentExtractedTexture;
      
      function compressBase64(base64Str) {
        return new Promise(function(resolve) {
          if (!base64Str || !base64Str.startsWith('data:image')) {
            resolve(base64Str);
            return;
          }
          var img = new Image();
          img.onload = function() {
            var cvs = document.createElement('canvas');
            cvs.width = 512;
            cvs.height = 512;
            var c = cvs.getContext('2d');
            c.drawImage(img, 0, 0, 512, 512);
            resolve(cvs.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function() { resolve(base64Str); };
          img.src = base64Str;
        });
      }

      var finalTex = await compressBase64(rawTex);
      var tempId = Date.now();

      var safeQ1 = Array.isArray(userSelections.q1) ? JSON.parse(JSON.stringify(userSelections.q1)) : [];
      // 🌟 관람객이 입력한 핵심 고민 선택 이유(concern_reason)를 기존 q1 배열 컬럼에 담아 전송하여 display.html과 완벽 연동
      if (safeQ1.length === 0 && userSelections.concern_reason && userSelections.concern_reason.trim().length > 0) {
        safeQ1 = [userSelections.concern_reason.trim()];
      }
      var safeQ2 = Array.isArray(userSelections.q2) ? JSON.parse(JSON.stringify(userSelections.q2)) : [];

      var curBodyColor = (typeof selectedBodyColor !== 'undefined' && selectedBodyColor) ? selectedBodyColor : 'blur';
      var baseAnt = (typeof selectedAntennaType !== 'undefined' && selectedAntennaType) ? String(selectedAntennaType).split('__')[0] : 'ball';
      var combinedAntForDB = baseAnt + (curBodyColor !== 'white' ? ('__' + curBodyColor) : '');

      var cleanName = sanitizeShareString(userSelections.q7_name) || '나비';
      var cleanMemo = sanitizeShareString(userSelections.q6_memo) || '';

      specimenButterfliesData.unshift({
        id: tempId, name: cleanName,
        wingId: selectedButterflyShape, antId: baseAnt, bodyColor: curBodyColor, patternId: selectedPatternId, q1: safeQ1,
        core_concern: userSelections.core_concern || (userSelections.q2 && userSelections.q2[0]) || "",
        concern_reason: userSelections.concern_reason || "",
        memo: cleanMemo, textureUrl: finalTex,
        date: new Date().toISOString().slice(0, 10).replace(/-/g, '. ')
      });

      var insertPayload = {
        name: cleanName || '이름없는 나비',
        wing_shape: selectedButterflyShape || 'crescent',
        pattern_id: selectedPatternId || 'crescent_none',
        antenna_type: combinedAntForDB,
        body_color: curBodyColor,
        q1: safeQ1,
        q2: safeQ2,
        core_concern: userSelections.core_concern || (safeQ2.length > 0 ? safeQ2[0] : ""),
        memo: cleanMemo,
        texture_url: finalTex
      };

      console.log("🚀 Supabase INSERT 요청 전송 시작. 데이터:", insertPayload);

      var { data, error } = await client.from('butterflies').insert([insertPayload]).select();

      // 🌟 혹시라도 Supabase 테이블에 아직 body_color 컬럼을 추가하기 전이라면, body_color만 제외하고 즉시 재시도하여 저장 실패를 방지
      if (error && String(error.message || '').indexOf('body_color') > -1) {
        console.warn("⚠️ butterflies 테이블에 body_color 컬럼이 아직 없어 기본 컬럼으로 재시도합니다.");
        var fallbackPayload = Object.assign({}, insertPayload);
        delete fallbackPayload.body_color;
        var retryRes = await client.from('butterflies').insert([fallbackPayload]).select();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) {
        console.error("❌ Supabase 저장 실패 (상세 내용):", error);
      } else {
        console.log("✅ Supabase 저장 성공 (결과 데이터):", data);
        if (data && data.length > 0 && data[0].id) {
          lastSavedButterflyId = data[0].id;
          for (var sIdx = 0; sIdx < specimenButterfliesData.length; sIdx++) {
            if (specimenButterfliesData[sIdx].id === tempId) {
              specimenButterfliesData[sIdx].id = data[0].id;
              break;
            }
          }
          return data[0].id;
        }
      }
      return null;
    } catch (err) { 
      console.error("❌ Supabase 나비 저장 예외 발생:", err); 
      return null;
    }
  })();

  return currentSavePromise;
};
var saveButterflyToSupabase = window.saveButterflyToSupabase;

var specimenButterfliesData = [];
var specimenContainer = document.getElementById('specimen-items-container');
var gallerySpawnTimers = [];
var currentGalleryConcernFilter = 'all';

function getPatternObjectForSpecimen(wingId, patternId) {
  if (typeof wingPatternDataset === 'undefined') return null;
  var patterns = wingPatternDataset[wingId] || wingPatternDataset['crescent'] || [];
  return patterns.find(function(p) { return p.id === patternId; }) || null;
}

// 🌟 키워드 필터 칩 바 PC 마우스 드래그 및 휠 가로 스크롤 지원
function bindGalleryFilterDragScroll() {
  var bar = document.getElementById('gallery-filter-chips-bar');
  if (!bar || bar.dataset.dragBound === '1') return;
  bar.dataset.dragBound = '1';

  var isDown = false, startX = 0, scrollLeft = 0, moved = false;

  bar.addEventListener('mousedown', function(e) {
    isDown = true;
    moved = false;
    startX = e.pageX - bar.offsetLeft;
    scrollLeft = bar.scrollLeft;
  });
  bar.addEventListener('mouseleave', function() { isDown = false; });
  bar.addEventListener('mouseup', function() { isDown = false; });
  window.addEventListener('mouseup', function() { isDown = false; });
  bar.addEventListener('mousemove', function(e) {
    if (!isDown) return;
    var x = e.pageX - bar.offsetLeft;
    var walk = (x - startX) * 1.4;
    if (Math.abs(walk) > 5) moved = true;
    if (moved) {
      e.preventDefault();
      bar.scrollLeft = scrollLeft - walk;
    }
  });
  bar.addEventListener('click', function(e) {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      moved = false;
    }
  }, true);
  bar.addEventListener('wheel', function(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      bar.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}
bindGalleryFilterDragScroll();

// 🌟 로드된 나비들의 핵심 고민(core_concern) 키워드를 추출하여 원터치 필터 칩 렌더링
function renderGalleryFilterChips() {
  var bar = document.getElementById('gallery-filter-chips-bar');
  if (!bar) return;
  bar.innerHTML = '';

  var freq = {};
  specimenButterfliesData.forEach(function(item) {
    var c = (item.core_concern || "").trim();
    if (c) freq[c] = (freq[c] || 0) + 1;
  });

  var topConcerns = Object.keys(freq).sort(function(a, b) {
    return freq[b] - freq[a];
  }).slice(0, 8);

  var chipList = [{ id: 'all', label: '#전체' }];
  topConcerns.forEach(function(k) {
    chipList.push({ id: k, label: '#' + k });
  });

  chipList.forEach(function(chipObj) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery-filter-chip' + (currentGalleryConcernFilter === chipObj.id ? ' active-chip' : '');
    btn.innerText = chipObj.label;
    btn.onclick = function() {
      currentGalleryConcernFilter = chipObj.id;
      bar.querySelectorAll('.gallery-filter-chip').forEach(function(el) {
        el.classList.remove('active-chip');
      });
      btn.classList.add('active-chip');
      var qVal = gallerySearchInput ? gallerySearchInput.value : "";
      renderFilteredGallery(qVal);
    };
    bar.appendChild(btn);
  });
}

function renderFilteredGallery(searchQuery) {
  if (!specimenContainer) return;
  specimenContainer.innerHTML = '';
  gallerySpawnTimers.forEach(function(t) { clearTimeout(t); });
  gallerySpawnTimers = [];

  var q = (searchQuery || "").trim().toLowerCase();
  var filteredData = specimenButterfliesData.filter(function(item) {
    var matchSearch = !q || (item.name || "").toLowerCase().indexOf(q) > -1;
    var matchConcern = (currentGalleryConcernFilter === 'all') || ((item.core_concern || "").trim() === currentGalleryConcernFilter);
    return matchSearch && matchConcern;
  });

  if (filteredData.length === 0) {
    specimenContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: #777777; font-size: 13px;">' +
      ((q || currentGalleryConcernFilter !== 'all') ? '조건에 맞는 나비가 없습니다.' : '아직 날려보낸 나비가 없습니다.<br>첫 번째 나비를 깨워보세요.') + '</div>';
    return;
  }

  var cardElements = [];
  filteredData.forEach(function(item, itemIdx) {
    var parsedAnt = String(item.antId || 'ball').split('__');
    var cleanAntId = parsedAnt[0] || 'ball';
    var itemBodyColor = item.bodyColor || parsedAnt[1] || 'white';

    var wing = butterflyPathData[item.wingId] || wingDataset[0];
    var ant = antennaDataset.find(function(a) { return a.id === cleanAntId; }) || antennaDataset[0];
    var pat = getPatternObjectForSpecimen(item.wingId, item.patternId);
    var defaultTexColor1 = itemBodyColor === 'black' ? '#000000' : '#ffffff';
    var defaultTexColor2 = itemBodyColor === 'black' ? '#000000' : '#e5e7eb';
    var tex = item.textureUrl || createFallbackDummyTexture(defaultTexColor1, defaultTexColor2);
    var card = document.createElement('div');
    card.className = 'specimen-card-item';
    card.setAttribute('data-specimen-id', item.id);
    var rawName = item.name || "나비";
    var displayName = rawName.length > 10 ? rawName.slice(0, 10) + '...' : rawName;
    var safeRawName = escapeHtmlSafe(rawName);
    var safeDisplayName = escapeHtmlSafe(displayName);

    var clipId = 'specimen-wing-clip-' + item.id;
    var bodyMaskId = 'specimen-body-mask-' + item.id;
    var bodyBlurId = 'specimen-body-blur-' + item.id;
    var wingPath = wing.wingD || wing.d;
    var bodyPath = wing.bodyD || "";

    var patternSvg = "";
    if (pat && pat.path) {
      patternSvg = '<image href="' + pat.path + '" x="0" y="0" width="' + wing.w + '" height="' + wing.h + '" preserveAspectRatio="none" style="mix-blend-mode: multiply;" opacity="0.95"/>';
    }

    var wingBaseFill = itemBodyColor === 'black' ? '#000000' : (itemBodyColor === 'blur' ? '#d4d4d8' : '#ffffff');
    var wingBaseBgSvg = '<path d="' + wingPath + '" fill="' + wingBaseFill + '"/>';

    var extraBodyDefs = "";
    var bodyAndAntElementSvg = "";

    if (itemBodyColor === 'black') {
      bodyAndAntElementSvg =
        (bodyPath ? '<path d="' + bodyPath + '" fill="#000000"/>' : '') +
        (ant ? '<g transform="translate(' + wing.headX + ',' + wing.headY + ')" color="#000000">' + ant.render(10.5) + '</g>' : '');
    } else if (itemBodyColor === 'blur') {
      extraBodyDefs =
        '<mask id="' + bodyMaskId + '" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1400" height="1400">' +
          '<rect x="-200" y="-200" width="1400" height="1400" fill="black"/>' +
          (bodyPath ? '<path d="' + bodyPath + '" fill="white" fill-rule="nonzero"/>' : '') +
          (ant ? '<g transform="translate(' + wing.headX + ',' + wing.headY + ')" color="#ffffff">' + ant.render(10.5) + '</g>' : '') +
        '</mask>' +
        '<filter id="' + bodyBlurId + '" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>';
      bodyAndAntElementSvg =
        '<g mask="url(#' + bodyMaskId + ')">' +
          '<rect x="0" y="0" width="' + wing.w + '" height="' + wing.h + '" fill="#d4d4d8"/>' +
          '<image href="' + tex + '" x="0" y="0" width="' + wing.w + '" height="' + wing.h + '" preserveAspectRatio="none" filter="url(#' + bodyBlurId + ')"/>' +
        '</g>';
    } else {
      bodyAndAntElementSvg =
        (bodyPath ? '<path d="' + bodyPath + '" fill="#ffffff"/>' : '') +
        (ant ? '<g transform="translate(' + wing.headX + ',' + wing.headY + ')" color="#ffffff">' + ant.render(10.5) + '</g>' : '');
    }

    // 🌟 각 나비마다 서로 다른 호흡 딜레이와 미세 주기를 부여하여 자연스럽게 숨 쉬는 연출
    var breatheDelay = ((itemIdx * 0.43) % 3.2).toFixed(2);
    var breatheDur = (3.1 + ((itemIdx * 0.29) % 0.9)).toFixed(2);

    // 🌟 나비 둘러보기 2D 나비 SVG 크기를 기존(210x178)에서 260x220으로 한층 더 확대
    card.innerHTML = 
      '<div class="specimen-butterfly-wrap"><div class="specimen-pin-head"></div>' +
      '<svg class="specimen-shadow-drop" width="260" height="220" viewBox="0 0 ' + wing.w + ' ' + wing.h + '" style="overflow: visible; animation-delay: -' + breatheDelay + 's; animation-duration: ' + breatheDur + 's;">' +
        '<defs>' +
          '<clipPath id="' + clipId + '">' +
            '<path d="' + wingPath + '" fill-rule="nonzero"/>' +
          '</clipPath>' +
          extraBodyDefs +
        '</defs>' +
        '<g clip-path="url(#' + clipId + ')">' +
          wingBaseBgSvg +
          '<image href="' + tex + '" x="0" y="0" width="' + wing.w + '" height="' + wing.h + '" preserveAspectRatio="none"/>' +
          patternSvg +
        '</g>' +
        bodyAndAntElementSvg +
      '</svg></div>' +
      '<div class="specimen-pill-label"><span class="label-text" title="' + safeRawName + '">' + safeDisplayName + '</span></div>';

    card.onclick = function(e) {
      e.stopPropagation();
      if (specimenContainer) specimenContainer.querySelectorAll('.specimen-pill-label').forEach(function(l) { l.classList.remove('active-touched'); });
      var curLbl = card.querySelector('.specimen-pill-label');
      if (curLbl) curLbl.classList.add('active-touched');
      if (typeof openSpecimen3DModal === 'function') {
        openSpecimen3DModal(item, item.textureUrl || createFallbackDummyTexture(defaultTexColor1, defaultTexColor2));
      }
    };
    specimenContainer.appendChild(card);
    cardElements.push(card);
  });

  cardElements.forEach(function(cardEl, idx) {
    var timer = setTimeout(function() { if (cardEl) cardEl.classList.add('revealed'); }, idx * 60);
    gallerySpawnTimers.push(timer);
  });
}

// 🌟 스크롤 속도에 반응하여 나비들이 미세하게 흔들리는 초경량 바람(Scroll Tilt) 효과
var galleryScrollResetTimer = null;
function bindGalleryScrollWindEffect() {
  var viewport = document.getElementById('gallery-pan-viewport');
  var board = document.getElementById('gallery-specimen-board');
  if (!viewport || !board || viewport.dataset.windBound === '1') return;
  viewport.dataset.windBound = '1';

  var lastScrollTop = viewport.scrollTop;
  viewport.addEventListener('scroll', function() {
    var curTop = viewport.scrollTop;
    var delta = curTop - lastScrollTop;
    lastScrollTop = curTop;

    var tiltDeg = Math.max(-14, Math.min(14, delta * 0.45));
    var shiftPx = Math.max(-5, Math.min(5, -delta * 0.16));

    board.style.setProperty('--scroll-tilt', tiltDeg.toFixed(1) + 'deg');
    board.style.setProperty('--scroll-shift', shiftPx.toFixed(1) + 'px');

    clearTimeout(galleryScrollResetTimer);
    galleryScrollResetTimer = setTimeout(function() {
      board.style.setProperty('--scroll-tilt', '0deg');
      board.style.setProperty('--scroll-shift', '0px');
    }, 120);
  }, { passive: true });
}
bindGalleryScrollWindEffect();

var gallerySearchInput = document.getElementById('gallery-search-input');
if (gallerySearchInput) {
  gallerySearchInput.placeholder = "나비 이름을 검색해보세요";
  gallerySearchInput.oninput = function(e) { renderFilteredGallery(e.target.value); };
}

async function initSpecimenGallery() {
  currentGalleryConcernFilter = 'all';
  if (gallerySearchInput) {
    gallerySearchInput.value = "";
    gallerySearchInput.placeholder = "나비 이름을 검색해보세요";
  }
  var client = getSupabaseClient();
  if (client) {
    try {
      var res = await client.from('butterflies').select('*').order('id', { ascending: false }).limit(24);
      if (res.data && res.data.length > 0) {
        specimenButterfliesData = res.data.map(function(item) {
          var rawAntStr = String(item.antenna_type || "ball");
          var antParts = rawAntStr.split('__');
          return {
            id: item.id,
            name: sanitizeShareString(item.name) || "나비",
            wingId: item.wing_shape || "crescent",
            antId: antParts[0] || "ball",
            bodyColor: item.body_color || antParts[1] || "white",
            patternId: item.pattern_id || (item.wing_shape ? item.wing_shape + '_none' : 'crescent_none'),
            q1: Array.isArray(item.q1) ? item.q1 : [],
            core_concern: item.core_concern || "",
            memo: sanitizeShareString(item.memo) || "",
            textureUrl: item.texture_url || null,
            date: item.created_at ? new Date(item.created_at).toISOString().slice(0, 10).replace(/-/g, '. ') : "2026. 10. 24"
          };
        });
      }
    } catch (err) { console.error("Supabase 데이터 조회 오류:", err); }
  }
  renderGalleryFilterChips();
  renderFilteredGallery("");
}

function closeSpecimenDetailModal() {
  var modal = document.getElementById('specimen-detail-modal');
  if (modal) modal.classList.add('hidden');
  if (typeof stopModal3DScene === 'function') {
    stopModal3DScene();
  } else if (typeof modalAnimFrameId !== 'undefined' && modalAnimFrameId) {
    cancelAnimationFrame(modalAnimFrameId);
    modalAnimFrameId = null;
  }
}

var btnCloseSpecimenModal = document.getElementById('btn-close-specimen-modal');
if (btnCloseSpecimenModal) {
  btnCloseSpecimenModal.onclick = closeSpecimenDetailModal;
}

var specimenModalBackdrop = document.querySelector('#specimen-detail-modal .specimen-modal-backdrop');
if (specimenModalBackdrop) {
  specimenModalBackdrop.onclick = closeSpecimenDetailModal;
}

window.addEventListener('keydown', function(e) {
  var activeTag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
  if (activeTag === 'input' || activeTag === 'textarea') return;

  if (e.key === 'd' || e.key === 'D') {
    var devNav = document.getElementById('dev-quick-navigator');
    if (devNav) {
      var isHidden = devNav.style.getPropertyValue('display') === 'none' || getComputedStyle(devNav).display === 'none';
      if (isHidden) {
        devNav.style.setProperty('display', 'flex', 'important');
      } else {
        devNav.style.setProperty('display', 'none', 'important');
      }
    }
  }
});

window.addEventListener('resize', function() {
  var activeScreen = document.querySelector('.screen.active');
  if (activeScreen && activeScreen.id === 'screen-survey' && currentStepIdx === 2) {
    resizeBubblePhysicsCanvas();
  } else if (activeScreen && activeScreen.id === 'screen-survey-concern-top7') {
    var top7Container = document.getElementById('top7-physics-container');
    var top7Canvas = document.getElementById('top7-physics-canvas');
    if (top7Container && top7Canvas) {
      var rect = top7Container.getBoundingClientRect();
      top7Canvas.width = rect.width || window.innerWidth;
      top7Canvas.height = top7Container.clientHeight || rect.height || (window.innerHeight - 240);
    }
  } else if (activeScreen && isCoverWaveAllowed(activeScreen.id)) {
    resizeCoverWaveCanvas();
  }
});

initCoverWaveCanvas();
replayCoverIntroAnimation();
updateDevScreenBadge();
const clock = new THREE.Clock();
const dummyObj = new THREE.Object3D(); 
    
const _vDir = new THREE.Vector3();
const _vTargetPos = new THREE.Vector3();
const _vOrbit = new THREE.Vector3();
const _vLeave = new THREE.Vector3(18.0, 10.5, 8.0);
const _vStep = new THREE.Vector3();
const _handUnprojectVec = new THREE.Vector3();

let handTarget3D = new THREE.Vector3(999, 999, 8.0);
let targetHandPos3D = new THREE.Vector3(999, 999, 8.0);
let prevHandTarget3D = new THREE.Vector3(999, 999, 8.0);
let isHandDetected = false;
let lastHandResultTime = 0;
let interactionMode = 'none';
    
let specialButterfly = null;
let fistButterflies = []; 
let isCreatingSpecialButterfly = false;
let landOneGestureTimer = null;

const floatingConcernCard = document.getElementById('floating-concern-card');
const floatingConcernTag = document.getElementById('floating-concern-tag');
const floatingConcernReason = document.getElementById('floating-concern-reason');

const floatingInfoCard = document.getElementById('floating-info-card');
const floatingName = document.getElementById('floating-butterfly-name');
const floatingMemo = document.getElementById('floating-butterfly-memo');

// 🌟 손가락 교감 타이머와 세레머니 타이머를 완벽 분리하여 서로 충돌하지 않도록 보호
let landingStorySequenceTimer = null;
let landingReasonDelayTimer = null;
let landingMemoDelayTimer = null;
let handTypingTimeout = null;
let ceremonyTypingTimeout = null;

let activeCeremonyButterfly = null;
let ceremonyCardTimer = null;

// 🌟 특수문자(<, >, &) 및 이모지 입력 시에도 DOM 깨짐이나 XSS가 발생하지 않는 안전한 타이핑 함수
function typeWriterText(targetElement, fullText, speed = 45, callback = null, isCeremonyCard = false) {
  if (isCeremonyCard) {
    if (ceremonyTypingTimeout) clearTimeout(ceremonyTypingTimeout);
  } else {
    if (handTypingTimeout) clearTimeout(handTypingTimeout);
  }

  targetElement.innerHTML = '';
  const textSpan = document.createElement('span');
  const cursorSpan = document.createElement('span');
  cursorSpan.className = 'typing-cursor';
  targetElement.appendChild(textSpan);
  targetElement.appendChild(cursorSpan);

  const chars = Array.from(String(fullText || ''));
  let index = 0;

  function step() {
    if (index <= chars.length) {
      textSpan.textContent = chars.slice(0, index).join('');
      const isDone = index === chars.length;
      index++;
      if (!isDone) {
        if (isCeremonyCard) {
          ceremonyTypingTimeout = setTimeout(step, speed);
        } else {
          handTypingTimeout = setTimeout(step, speed);
        }
      } else {
        if (cursorSpan.parentNode) cursorSpan.parentNode.removeChild(cursorSpan);
        if (callback) callback();
      }
    }
  }
  step();
}

function resetHandCards() {
  clearTimeout(landingStorySequenceTimer);
  clearTimeout(landingReasonDelayTimer);
  clearTimeout(landingMemoDelayTimer);
  if (handTypingTimeout) clearTimeout(handTypingTimeout);

  if (floatingConcernCard) floatingConcernCard.classList.remove('visible');
  if (floatingConcernReason) floatingConcernReason.innerHTML = '';
      
  if (!activeCeremonyButterfly) {
    if (floatingInfoCard) {
      floatingInfoCard.classList.remove('visible');
      floatingInfoCard.style.left = '0px';
    }
    if (floatingMemo) floatingMemo.innerHTML = '';
  }
}

function triggerLandingStorySequence(b) {
  resetHandCards();
  if (floatingConcernCard) {
    floatingConcernTag.innerText = `#${b.core_concern}`;
    floatingConcernCard.classList.add('visible');
    const fullReason = `"${b.concern_reason}"`;
    landingReasonDelayTimer = setTimeout(() => {
      typeWriterText(floatingConcernReason, fullReason, 45, null, false);
    }, 150);
  }

  landingStorySequenceTimer = setTimeout(() => {
    if (floatingConcernCard) floatingConcernCard.classList.remove('visible');
    if (floatingInfoCard && !activeCeremonyButterfly) {
      floatingInfoCard.style.left = '0px';
      floatingName.innerText = `‘${b.name}’`;
      floatingInfoCard.classList.add('visible');
      const fullMemo = `"${b.memo}"`;
      landingMemoDelayTimer = setTimeout(() => {
        typeWriterText(floatingMemo, fullMemo, 45, null, false);
      }, 150);
    }
  }, 4200);
}

function triggerCeremonyCardSequence(b) {
  clearTimeout(ceremonyCardTimer);
  if (ceremonyTypingTimeout) clearTimeout(ceremonyTypingTimeout);

  // 나비의 3D 월드 Y좌표를 화면 2D Y좌표로 정확히 투영
  const bPos = new THREE.Vector3(0, b.group.position.y, b.group.position.z);
  bPos.project(camera);
  const screenCY = (-(bPos.y) * 0.5 + 0.5) * window.innerHeight;

  // 나비 아래쪽에 알맞은 간격으로 수직 정렬
  const cardTop = screenCY + (window.innerHeight * 0.135);

  // CSS 엔진의 -50%를 적용하여 화면 정중앙 수직선에 1px 오차 없이 완벽 정렬
  floatingInfoCard.style.left = '50%';
  floatingInfoCard.style.transform = `translate3d(-50%, ${cardTop}px, 0)`;
  floatingName.innerText = `‘${b.name}’`;
  floatingInfoCard.classList.add('visible');

  const fullMemo = `"${b.memo}"`;
  // 🌟 대기열(ceremonyQueue)에 밀려 있는 나비가 많을 경우 카드 노출 시간을 2800ms로 단축하여 인터랙션 병목 해소
  const cardDisplayDuration = ceremonyQueue.length >= 2 ? 2800 : 5000;

  typeWriterText(floatingMemo, fullMemo, 45, () => {
    ceremonyCardTimer = setTimeout(() => {
      if (floatingInfoCard) floatingInfoCard.classList.remove('visible');
          
      setTimeout(() => {
        if (b && b.isCeremony && b.ceremonyStage === 'resting') {
          b.ceremonyStage = 'flying_up';
          b.takeoffTimer = 0;
          b.state = 'flying';
          b.velocity.set(0, 0.009, 0);
        }
      }, 1000);
    }, cardDisplayDuration);
  }, true);
}

let currentScreenX = 0, currentScreenY = 0;
let targetScreenX = 0, targetScreenY = 0;
const handPointer = document.getElementById('hand-pointer');

/* ========================================================
   이동 및 날개짓 물리 연산 (상하/대각선 360도 전방위 유영 엔진)
   ======================================================== */
function updateMotion(b, dt, time) {
  let currentTargetScale = b.targetScale;

  if (b.isCeremony) {
    b.group.scale.set(0.75, 0.75, 0.75);
  } else if (b.isSpecialLanding) {
    b.group.scale.set(b.targetScale, b.targetScale, b.targetScale);
  } else if (b.isAscendingArrival) {
    b.arrivalTimer += dt;
    b.group.scale.set(
      b.group.scale.x + (b.targetScale - b.group.scale.x) * 0.04,
      b.group.scale.y + (b.targetScale - b.group.scale.y) * 0.04,
      b.group.scale.z + (b.targetScale - b.group.scale.z) * 0.04
    );
    b.velocity.y *= 0.99;
    if (b.arrivalTimer > 5.5 || b.group.position.y > 0) b.isAscendingArrival = false; 
  } else {
    b.group.scale.set(
      b.group.scale.x + (currentTargetScale - b.group.scale.x) * 0.1,
      b.group.scale.y + (currentTargetScale - b.group.scale.y) * 0.1,
      b.group.scale.z + (currentTargetScale - b.group.scale.z) * 0.1
    );
  }

  const baseRotL = (b.leftWing.userData && b.leftWing.userData.baseRotY) || 0;
  const baseRotR = (b.rightWing.userData && b.rightWing.userData.baseRotY) || 0;

  if (b.wingPhase === undefined) b.wingPhase = b.seed || 0;

  let currentFlapSpeed = b.speed;
  if (b.isSpecialLanding && b.specialState === 'approaching') {
    currentFlapSpeed = b.speed * 1.05;
  } else if (b.isCeremony) {
    if (b.ceremonyStage === 'rising') {
      const dy = Math.max(0, 0.3 - b.group.position.y);
      const speedFactor = Math.min(1.0, Math.max(0.35, dy / 2.0));
      currentFlapSpeed = b.speed * 0.92 * speedFactor;
    } else if (b.ceremonyStage === 'resting') {
      const restTime = b.ceremonyRestTimer || 0;
      const settleProgress = Math.min(1.0, restTime / 2.2);
      currentFlapSpeed = b.speed * 0.92 * 0.35 * (1.0 - settleProgress);
    } else if (b.ceremonyStage === 'flying_up') {
      const takeoffProg = Math.min(1.0, (b.takeoffTimer || 0) / 2.8);
      currentFlapSpeed = b.speed * (0.40 + 1.05 * Math.pow(takeoffProg, 1.3));
    } else {
      currentFlapSpeed = b.speed;
    }
  } else if (b.isAscendingArrival) {
    currentFlapSpeed = b.speed * 1.25;
  }

  b.wingPhase = (b.wingPhase + dt * currentFlapSpeed) % (Math.PI * 2);
  const phase = b.wingPhase;

  if (b.state === 'landing_rest') {
      if (b.isCeremony) {
          const restTime = b.ceremonyRestTimer || 0;
          const settleProg = Math.min(1.0, restTime / 2.2);
          const easeSettle = settleProg * settleProg * (3.0 - 2.0 * settleProg);

          const wingWave = Math.sin(phase);
          const activeFold = (0.40 + wingWave * 0.60) * (1.0 - easeSettle);
          const restingFold = 0.12 * easeSettle + Math.sin(time * 2.0 + b.seed) * 0.02 * easeSettle;

          const finalFold = activeFold + restingFold;
          b.leftWing.rotation.y = baseRotL + finalFold;
          b.rightWing.rotation.y = baseRotR - finalFold;

          b.innerGroup.rotation.set(0, 0, 0);
          b.innerGroup.position.set(0, 0, 0);
          b.strokePower = 0;
      } else {
          b.flapAmp *= 0.92; 
          const restPhase = (time * 3.5 + b.seed);
          const restCycle = Math.sin(restPhase);

          const restFold = 1.15;
          const flap = restCycle * 0.08 * b.flapAmp;

          b.leftWing.rotation.y = baseRotL + flap + restFold * (1 - b.flapAmp);
          b.rightWing.rotation.y = baseRotR - flap - restFold * (1 - b.flapAmp);
          b.innerGroup.rotation.z = Math.sin(time * 2.0 + b.seed) * 0.02;
          b.innerGroup.rotation.x = Math.PI / 2;
          b.innerGroup.rotation.y = Math.PI;
          b.innerGroup.position.set(0, 0, 0);
          b.strokePower = 0;
      }
  } else {
      b.flapAmp += (1.0 - b.flapAmp) * 0.1; 
          
      const wingWave = Math.sin(phase);
      const strokePower = (wingWave < 0) ? Math.sin(-wingWave * Math.PI * 0.5) * 0.55 : 0;
      b.strokePower = strokePower;

      const wingFold = (0.40 + wingWave * 0.60) * b.flapAmp;
      b.leftWing.rotation.y = baseRotL + wingFold;
      b.rightWing.rotation.y = baseRotR - wingFold;

      b.innerGroup.rotation.x = b.isCeremony ? 0 : Math.PI / 2;
      b.innerGroup.rotation.y = b.isCeremony ? 0 : Math.PI;
      b.innerGroup.position.set(0, 0, 0);
      b.innerGroup.rotation.z = Math.sin(phase) * 0.025 * b.flapAmp;
  }

  const bobAmp = 0.09 * b.flapAmp;
  const currentBobY = Math.cos(phase) * bobAmp;
  const deltaBobY = currentBobY - (b.prevBobY || 0);
  b.prevBobY = currentBobY;
  b.group.position.y += deltaBobY;

  let isFollowing = false;

  if (b.isCeremony) {
      isFollowing = true;

      // 🌟 세레머니 나비도 아래쪽에서 위로 솔솔 피어오르는 초미세 팅커벨 가루 스폰
      if (b.ceremonyStage === 'rising' || b.ceremonyStage === 'flying_up') {
          spawnCeremonyParticle(b.group.position);
          spawnCeremonyParticle(b.group.position);
          if (Math.random() < 0.6) spawnCeremonyParticle(b.group.position);
      } else if (b.ceremonyStage === 'resting' && Math.random() < 0.15) {
          spawnCeremonyParticle(b.group.position);
      }

      if (b.ceremonyStage === 'rising') {
          b.state = 'flying';
          const dy = 0.3 - b.group.position.y;

          if (dy > 0.008) {
              const speedFactor = Math.min(1.0, Math.max(0.12, dy / 2.0));
              b.group.position.y += 0.034 * speedFactor * (dt * 60.0);
              b.group.position.x += (0 - b.group.position.x) * 0.055;
              b.group.position.z = 8.0;

              b.innerGroup.rotation.set(0, 0, 0);
              b.group.rotation.set(0.06 * speedFactor, 0, 0);
          } else {
              b.group.position.set(0, 0.3, 8.0);
              b.velocity.set(0, 0, 0);
              b.group.rotation.set(0, 0, 0);
              b.innerGroup.rotation.set(0, 0, 0);
              b.ceremonyStage = 'resting';
              b.ceremonyRestTimer = 0;
              b.state = 'landing_rest';
              activeCeremonyButterfly = b;
              triggerCeremonyCardSequence(b);
          }
      }
      else if (b.ceremonyStage === 'resting') {
          b.state = 'landing_rest';
          b.velocity.set(0, 0, 0);
          b.group.position.set(0, 0.3, 8.0);

          b.innerGroup.rotation.set(0, 0, 0);
          b.group.rotation.set(0, 0, 0);

          b.ceremonyRestTimer = (b.ceremonyRestTimer || 0) + dt;
          if (b.ceremonyRestTimer > 14.0) {
              if (floatingInfoCard) floatingInfoCard.classList.remove('visible');
              b.ceremonyStage = 'flying_up';
              b.takeoffTimer = 0;
              b.state = 'flying';
              b.velocity.set(0, 0.009, 0);
          }
      }
      else if (b.ceremonyStage === 'flying_up') {
          b.state = 'flying';
          b.takeoffTimer = (b.takeoffTimer || 0) + dt;

          const takeoffProgress = Math.min(1.0, b.takeoffTimer / 2.8);
          b.velocity.y = 0.009 + 0.11 * Math.pow(takeoffProgress, 1.6);
          b.velocity.x += Math.sin(time * 2.5 + b.seed) * 0.0022;

          _vStep.copy(b.velocity).multiplyScalar(dt * 60.0);
          b.group.position.add(_vStep);

          b.innerGroup.rotation.set(0, 0, 0);
          b.group.rotation.set(0.12 * takeoffProgress, 0, b.velocity.x * -5.0);

          if (b.group.position.y > 8.5 || b.takeoffTimer > 6.5) {
              b.isCeremony = false;
              b.ceremonyStage = null;
              if (b.haloSprite) {
                  b.innerGroup.remove(b.haloSprite);
                  b.haloSprite = null;
              }
              b.group.position.z = -0.5 - Math.random() * 5.0;
              b.innerGroup.rotation.x = Math.PI / 2;
              b.innerGroup.rotation.y = Math.PI;
              b.speedBase = 0.080;
              b.screenAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
              b.depthAngle = (Math.random() - 0.5) * 0.35;
              userFlock.push(b);

              if (userFlock.length > MAX_USER_BUTTERFLIES) {
                  const oldest = userFlock.shift();
                  disposeButterfly(oldest);
              }

              if (floatingInfoCard) floatingInfoCard.style.left = '0px';
              activeCeremonyButterfly = null;
              isCeremonyActive = false;
              // 🌟 대기 중인 세레머니가 많으면 다음 등장 대기 시간을 2초로 단축
              const nextCeremonyDelay = ceremonyQueue.length >= 2 ? 2000 : 5000;
              triggerNextCeremonyWithDelay(nextCeremonyDelay);
          }
      }
  }
  else if (b.isSpecialLanding) {
      isFollowing = true;

      // 🌟 손가락 나비도 아래쪽에서 위로 솔솔 피어오르는 초미세 팅커벨 가루 스폰
      if (b.specialState === 'approaching' || b.specialState === 'leaving') {
          spawnEnergyParticle(b.group.position);
          spawnEnergyParticle(b.group.position);
          if (Math.random() < 0.6) spawnEnergyParticle(b.group.position);
      }

      if (b.specialState === 'approaching') {
          const dx = b.group.position.x - handTarget3D.x;
          const dy = b.group.position.y - handTarget3D.y;
          const dist2D = Math.hypot(dx, dy);

          if (dist2D < 1.3) {
              b.group.position.z = 8.0;
              b.specialState = 'landed';
              triggerLandingStorySequence(b);
          } else {
              b.state = 'flying';
              _vDir.subVectors(handTarget3D, b.group.position);
              _vDir.z = 0; 
              _vDir.normalize().multiplyScalar(0.10);
              b.velocity.lerp(_vDir, 0.06); 
                  
              _vTargetPos.copy(b.group.position).add(b.velocity);
              dummyObj.position.copy(b.group.position);
              dummyObj.lookAt(_vTargetPos);
              const approachBank = Math.max(-0.6, Math.min(0.6, b.velocity.x * 2.5));
              dummyObj.rotateZ(approachBank); 
              b.group.quaternion.slerp(dummyObj.quaternion, 0.16);
          }
      }
          
      if (b.specialState === 'landed') {
          b.state = 'landing_rest';
          b.velocity.set(0, 0, 0);
          b.group.position.x += (handTarget3D.x - b.group.position.x) * 0.12;
          b.group.position.y += (handTarget3D.y - b.group.position.y) * 0.12;
          b.group.position.z = 8.0;
              
          dummyObj.position.copy(b.group.position);
          dummyObj.lookAt(camera.position); 
          dummyObj.rotateY(Math.PI / 2);
          dummyObj.rotateZ(0.25);
          b.group.quaternion.slerp(dummyObj.quaternion, 0.18);
      }

      if (b.specialState === 'leaving') {
          b.state = 'flying';
          b.leavingTimer = (b.leavingTimer || 0) + dt;

          const organicWobbleY = Math.sin(time * 3.2 + b.seed) * 1.6 + Math.cos(time * 6.0 + b.seed * 1.5) * 0.7;
          const organicWobbleZ = Math.sin(time * 2.5 + b.seed * 1.8) * 3.2;

          _vLeave.set(
              18.0,
              10.5 + organicWobbleY * 0.25, 
              8.0 + organicWobbleZ
          );

          _vDir.subVectors(_vLeave, b.group.position).normalize().multiplyScalar(0.11);
          _vDir.y += Math.sin(time * 4.5 + b.seed) * 0.04;
          _vDir.z += Math.cos(time * 3.8 + b.seed) * 0.05;

          b.velocity.lerp(_vDir, 0.05); 
              
          _vTargetPos.copy(b.group.position).add(b.velocity);
          dummyObj.position.copy(b.group.position);
          dummyObj.lookAt(_vTargetPos);

          const bankRoll = Math.max(-0.6, Math.min(0.6, -(b.velocity.y * 4.0) + (b.velocity.x * 1.5)));
          dummyObj.rotateZ(bankRoll);
          dummyObj.rotateX(Math.sin(time * 4.0 + b.seed) * 0.15);

          b.group.quaternion.slerp(dummyObj.quaternion, 0.14);

          if (b.group.position.x > 15.0 || b.group.position.y > 9.5 || b.leavingTimer > 6.0) {
              disposeButterfly(specialButterfly);
              specialButterfly = null;
              if (ceremonyQueue.length > 0 && !isCeremonyActive) {
                  triggerNextCeremonyWithDelay(1000);
              }
              return;
          }
      }
  } 
  else if (isHandDetected) {
      if (interactionMode === 'fist_gather' && fistButterflies.includes(b.id)) {
          isFollowing = true;
          b.state = 'flying';
              
          const orbitIdx = fistButterflies.indexOf(b.id);
          const orbitRadius = 1.35 + (orbitIdx * 0.28) + Math.sin(time * 0.6 + b.seed) * 0.15;

          const relX = b.group.position.x - handTarget3D.x;
          const relY = b.group.position.y - handTarget3D.y;
          const currentAngle = (Math.abs(relX) < 0.01 && Math.abs(relY) < 0.01)
            ? (b.seed + orbitIdx * 1.25)
            : Math.atan2(relY, relX);
          const lookAheadAngle = currentAngle + 0.52;

          const heightOffset = Math.sin(lookAheadAngle) * (orbitRadius * 0.85);
          const depthOffset = Math.sin(time * 0.65 + orbitIdx * 1.3 + b.seed) * 0.65;

          _vOrbit.set(
            Math.cos(lookAheadAngle) * orbitRadius,
            heightOffset,
            depthOffset
          );
          _vTargetPos.copy(handTarget3D).add(_vOrbit);
              
          const currentStroke = b.strokePower || 0;
          const currentSpeed = (b.speedBase || 0.085) * (1.0 + currentStroke * 0.55);

          _vDir.subVectors(_vTargetPos, b.group.position).normalize().multiplyScalar(currentSpeed);
          b.velocity.lerp(_vDir, 0.06);
          b.velocity.normalize().multiplyScalar(currentSpeed);
          b.screenAngle = Math.atan2(b.velocity.y, b.velocity.x);

          _vTargetPos.copy(b.group.position).add(b.velocity);
          dummyObj.position.copy(b.group.position);
          dummyObj.lookAt(_vTargetPos);
          const fistBank = Math.max(-0.55, Math.min(0.55, b.velocity.x * 2.0));
          dummyObj.rotateZ(fistBank); 
          b.group.quaternion.slerp(dummyObj.quaternion, 0.12);
      }
      else if (interactionMode === 'scatter' && !specialButterfly) {
          const dist = b.group.position.distanceTo(handTarget3D);
          if (dist < 26.0) {
              isFollowing = true;
              b.state = 'flying';
              _vDir.subVectors(b.group.position, handTarget3D);
              _vDir.z = 0; 
              _vDir.normalize();
              b.velocity.addScaledVector(_vDir, 0.06); 
              b.velocity.z *= 0.85; 
          }
      } 
  }

  if (!isFollowing && !b.isAscendingArrival) {
      b.state = 'flying';

      if (b.screenAngle === undefined) {
          b.screenAngle = Math.atan2(b.velocity.y, b.velocity.x) || (Math.random() * Math.PI * 2);
          b.depthAngle = (b.velocity.z / (b.speedBase || 0.08)) * 0.4 || 0;
          b.speedBase = 0.080 + (b.seed % 100) * 0.00020;
          b.turnRateAngle = 0;
          b.turnRateDepth = 0;
          b.angleBias = (Math.random() - 0.5) * 0.008;
          b.rollBias = (Math.random() - 0.5) * 0.10;
          b.dirChangeTimer = Math.random() * 3.0;
      }

      b.dirChangeTimer += dt;
      if (b.dirChangeTimer > 1.8 + (b.seed % 1.6)) {
          b.dirChangeTimer = 0;
          b.angleBias = (Math.random() - 0.5) * 0.010;
      }

      const organicTurn = Math.sin(time * 0.90 + b.seed) * 0.009 
                        + Math.cos(time * 1.35 + b.seed * 1.4) * 0.006 
                        + (b.angleBias || 0);

      let steerZ = 0;
      if (b.group.position.z > 1.2) steerZ = -1;
      else if (b.group.position.z < -6.0) steerZ = 1;

      b.turnRateAngle = (b.turnRateAngle || 0) * 0.85 + organicTurn * 0.12;

      if (steerZ !== 0) {
          const targetDepth = steerZ > 0 ? 0.35 : -0.35;
          b.turnRateDepth = (b.turnRateDepth || 0) * 0.84 + (targetDepth - (b.depthAngle || 0)) * 0.08 * 0.16;
      } else {
          const organicDepth = Math.sin(time * 0.45 + b.seed * 2.1) * 0.30;
          b.turnRateDepth = (b.turnRateDepth || 0) * 0.88 + (organicDepth - (b.depthAngle || 0)) * 0.05 * 0.14;
      }

      // 🌟 장시간 구동 시 screenAngle 무한 증감 방지를 위한 정규화
      b.screenAngle = Math.atan2(Math.sin(b.screenAngle + b.turnRateAngle), Math.cos(b.screenAngle + b.turnRateAngle));
      b.depthAngle = Math.max(-0.45, Math.min(0.45, (b.depthAngle || 0) + b.turnRateDepth));

      const currentStroke = b.strokePower || 0;
      const forwardSurge = 1.0 + (currentStroke * 0.55);
      const currentSpeed = b.speedBase * forwardSurge;

      const cosD = Math.cos(b.depthAngle);
      b.velocity.x = cosD * Math.cos(b.screenAngle) * currentSpeed;
      b.velocity.y = cosD * Math.sin(b.screenAngle) * currentSpeed;
      b.velocity.z = Math.sin(b.depthAngle) * currentSpeed;
  }

  let maxSpeed = 0.20;
  if (b.isSpecialLanding) {
      maxSpeed = (b.specialState === 'leaving') ? 0.15 : 0.12;
  } else if (b.isCeremony) {
      maxSpeed = 0.24;
  } else if (isFollowing && interactionMode === 'scatter') {
      maxSpeed = 0.20; 
  } else if (isFollowing && interactionMode === 'fist_gather') {
      maxSpeed = 0.20;
  }

  if (b.velocity.length() > maxSpeed) {
      b.velocity.multiplyScalar(0.92);
  }
      
  const timeFactor = dt * 60.0;
  _vStep.copy(b.velocity).multiplyScalar(timeFactor);
  b.group.position.add(_vStep);

  if (!isFollowing && !b.isAscendingArrival && !b.isCeremony && !b.isSpecialLanding) {
    if (b.group.position.x > 17.5) b.group.position.x = -17.5;
    else if (b.group.position.x < -17.5) b.group.position.x = 17.5;

    if (b.group.position.y > 10.5) b.group.position.y = -10.5;
    else if (b.group.position.y < -10.5) b.group.position.y = 10.5;
  }

  if (b.velocity.lengthSq() > 0.00001 && b.state === 'flying' && !isFollowing) {
    _vTargetPos.set(
      b.group.position.x + b.velocity.x,
      b.group.position.y + b.velocity.y,
      b.group.position.z + b.velocity.z
    );

    dummyObj.position.copy(b.group.position);
    dummyObj.lookAt(_vTargetPos); 

    const turnBank = Math.max(-0.6, Math.min(0.6, -(b.turnRateAngle || 0) * 35.0));
    const wobbleRoll = Math.sin(time * 1.5 + b.seed * 2.5) * 0.12 + (b.rollBias || 0);
    const strokeWobble = Math.sin(phase) * 0.04;

    const rollAngle = Math.max(-0.75, Math.min(0.75, turnBank + wobbleRoll + strokeWobble));

    dummyObj.rotateZ(rollAngle);

    b.group.quaternion.slerp(dummyObj.quaternion, 0.16);
  }
}

let releaseLandingTimer = null;
let accumulatedTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  accumulatedTime += dt;
  const time = accumulatedTime;

  updateCeremonyParticles(dt);
  updateEnergyParticles(dt);

  // 🌟 웹캠 일시 끊김 시 '유령 손' 자동 해제 방어 로직 (1.5초 이상 프레임 미수신 시 해제)
  if (isHandDetected && (performance.now() - lastHandResultTime > 1500)) {
    if (handPointer) handPointer.style.opacity = '0';
    isHandDetected = false;
    interactionMode = 'none';
    fistButterflies = [];
    if (!specialButterfly) resetHandCards();
  }

  if (isHandDetected) {
    handTarget3D.lerp(targetHandPos3D, 0.30);
    currentScreenX += (targetScreenX - currentScreenX) * 0.35;
    currentScreenY += (targetScreenY - currentScreenY) * 0.35;
        
    if (handPointer) {
      handPointer.style.transform = `translate3d(${currentScreenX - 26}px, ${currentScreenY - 26}px, 0)`;
    }

    const handCardX = (currentScreenX + 260 + 280 > window.innerWidth)
      ? Math.max(20, currentScreenX - 500)
      : (currentScreenX + 260);
    const handCardY = Math.max(20, Math.min(window.innerHeight - 180, currentScreenY - 145));

    if (floatingConcernCard && floatingConcernCard.classList.contains('visible')) { 
      floatingConcernCard.style.transform = `translate3d(${handCardX}px, ${handCardY}px, 0)`; 
    }
    if (floatingInfoCard && floatingInfoCard.classList.contains('visible') && !activeCeremonyButterfly) { 
      floatingInfoCard.style.left = '0px';
      floatingInfoCard.style.transform = `translate3d(${handCardX}px, ${handCardY}px, 0)`; 
    }
  }

  if (interactionMode === 'land_one' && isHandDetected) {
      if (releaseLandingTimer && (!specialButterfly || specialButterfly.specialState !== 'leaving')) {
          clearTimeout(releaseLandingTimer);
          releaseLandingTimer = null;
      }

      if (!specialButterfly && !activeCeremonyButterfly && !isCreatingSpecialButterfly) {
          if (!landOneGestureTimer) {
              landOneGestureTimer = setTimeout(() => {
                  if (interactionMode === 'land_one' && isHandDetected && !specialButterfly && !activeCeremonyButterfly && !isCreatingSpecialButterfly) {
                      isCreatingSpecialButterfly = true;
                      let targetData = {};
                      let isUserButterfly = false;
                      if (rawUserDataList.length > 0) {
                          const randIdx = Math.floor(Math.random() * rawUserDataList.length);
                          targetData = rawUserDataList[randIdx];
                          isUserButterfly = true;
                      } else {
                          targetData = {
                            wing_shape: DEFAULT_BUTTERFLY_SHAPES[Math.floor(Math.random() * DEFAULT_BUTTERFLY_SHAPES.length)],
                            antenna_type: 'ball'
                          };
                      }
                      specialButterfly = buildButterfly(targetData, isUserButterfly, false, true, 8.0);
                      isCreatingSpecialButterfly = false;
                  }
                  landOneGestureTimer = null;
              }, 2000);
          }
      }
  } else {
      if (landOneGestureTimer) {
          clearTimeout(landOneGestureTimer);
          landOneGestureTimer = null;
      }
      if (specialButterfly && specialButterfly.specialState !== 'leaving' && !releaseLandingTimer) {
          releaseLandingTimer = setTimeout(() => {
              if (specialButterfly) specialButterfly.specialState = 'leaving';
              resetHandCards();
              releaseLandingTimer = null;
          }, 450);
      }
  }

  for (let i = 0; i < defaultFlock.length; i++) updateMotion(defaultFlock[i], dt, time);
  for (let i = 0; i < userFlock.length; i++) updateMotion(userFlock[i], dt, time);
  if (specialButterfly) updateMotion(specialButterfly, dt, time);
  if (activeCeremonyButterfly) updateMotion(activeCeremonyButterfly, dt, time);
      
  prevHandTarget3D.copy(handTarget3D); 
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  updateRendererSize();
});

/* ========================================================
   2. Supabase 실시간 연동 및 동시다발 전송 순차 큐 시스템
   ======================================================== */
const ceremonyQueue = [];
let isCeremonyActive = false;
let ceremonyCooldownTimer = null;
const seenButterflyIds = new Set();
let maxSeenNumericId = 0;
let globalSupabaseInstance = null;

function registerSeenButterflyId(data) {
  if (!data || data.id === undefined || data.id === null || data.id === '') return false;
  const key = String(data.id);
  if (seenButterflyIds.has(key)) return false;
  seenButterflyIds.add(key);
  const numId = Number(data.id);
  if (!isNaN(numId) && numId > maxSeenNumericId) {
    maxSeenNumericId = numId;
  }
  // Set 크기가 무한히 커지지 않도록 1000개 초과 시 오래된 ID 정리
  if (seenButterflyIds.size > 1000) {
    const firstKey = seenButterflyIds.values().next().value;
    seenButterflyIds.delete(firstKey);
  }
  return true;
}

function queueNewButterfly(data) {
  ceremonyQueue.push(data);
  rawUserDataList.push(data);
  if (rawUserDataList.length > MAX_RECENT_USER_DATA) {
    rawUserDataList.shift();
    cleanupUnusedTextures();
  }
  const nextDelay = ceremonyQueue.length >= 2 ? 2000 : 5000;
  triggerNextCeremonyWithDelay(nextDelay);
}

function triggerNextCeremonyWithDelay(delayMs) {
  if (isCeremonyActive) return;
  if (ceremonyCooldownTimer) return;

  ceremonyCooldownTimer = setTimeout(() => {
    ceremonyCooldownTimer = null;
    startNextCeremonyFromQueue();
  }, delayMs);
}

function startNextCeremonyFromQueue() {
  if (isCeremonyActive) return;
  if (ceremonyQueue.length === 0) return;
  if (specialButterfly) {
    triggerNextCeremonyWithDelay(1000);
    return;
  }

  isCeremonyActive = true;
  const nextData = ceremonyQueue.shift();
  activeCeremonyButterfly = buildButterfly(nextData, true, false, false, 8.0, true);
}

setTimeout(() => {
  try {
    if (window.supabase) {
      const SUPABASE_URL = 'https://djmdzsbfsobsutphragw.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbWR6c2Jmc29ic3V0cGhyYWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODQ3NTgsImV4cCI6MjEwNTQ2MDc1OH0.BC7llaSjbq6cYhDlRqrwJaycpQ6gSNcp5LgYBeM6WEM';
      const supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      globalSupabaseInstance = supabaseInstance;

      function addUserButterfly(data, isDelayedArrival = false, isCeremony = false) {
        if (!data) return;
        if (data.id !== undefined && data.id !== null) {
          if (!registerSeenButterflyId(data)) return;
        }

        if (isCeremony) {
          queueNewButterfly(data);
        } else {
          rawUserDataList.push(data);
          if (rawUserDataList.length > MAX_RECENT_USER_DATA) {
            rawUserDataList.shift();
            cleanupUnusedTextures();
          }
          const butterfly = buildButterfly(data, true, isDelayedArrival, false, 8.0, false);
          userFlock.push(butterfly);

          if (userFlock.length > MAX_USER_BUTTERFLIES) {
            const oldest = userFlock.shift();
            disposeButterfly(oldest);
          }
        }
      }

      supabaseInstance.from('butterflies')
        .select('*')
        .order('id', { ascending: false })
        .limit(MAX_USER_BUTTERFLIES)
        .then(({ data, error }) => {
          if (error) {
            console.error("Supabase 데이터 조회 오류:", error);
            return;
          }
          if (data && data.length > 0) {
            data.reverse().forEach(item => addUserButterfly(item, false, false));
          }
        })
        .catch(e => console.error("Supabase 데이터 연동 실패:", e));

      // 🌟 장시간 전시 중 네트워크 순단 시 자동 재연결되는 실시간 구독
      let activeRealtimeChannel = null;
      let reconnectTimer = null;

      function subscribeRealtimeButterflies() {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        if (activeRealtimeChannel) {
          try { supabaseInstance.removeChannel(activeRealtimeChannel); } catch (e) {}
          activeRealtimeChannel = null;
        }

        activeRealtimeChannel = supabaseInstance.channel('public:butterflies:' + Date.now())
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'butterflies' }, (payload) => {
            if (payload && payload.new) {
              addUserButterfly(payload.new, false, true);
            }
          })
          .subscribe((status) => {
            if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
              if (!reconnectTimer) {
                reconnectTimer = setTimeout(subscribeRealtimeButterflies, 5000);
              }
            }
          });
      }
      subscribeRealtimeButterflies();

      // 🌟 웹소켓 누락 대비 15초 주기 경량 폴링 백업: 대용량 texture_url을 매번 받지 않고 id만 먼저 조회 후 신규 나비가 있을 때만 전체 데이터 조회
      setInterval(() => {
        supabaseInstance.from('butterflies')
          .select('id')
          .order('id', { ascending: false })
          .limit(5)
          .then(({ data, error }) => {
            if (!error && Array.isArray(data) && data.length > 0) {
              const unseenIds = data
                .filter(item => {
                  if (!item || item.id === undefined || item.id === null) return false;
                  const numId = Number(item.id);
                  return !seenButterflyIds.has(String(item.id)) && (maxSeenNumericId === 0 || (!isNaN(numId) && numId > maxSeenNumericId));
                })
                .map(item => item.id);

              if (unseenIds.length > 0) {
                supabaseInstance.from('butterflies')
                  .select('*')
                  .in('id', unseenIds)
                  .order('id', { ascending: true })
                  .then(({ data: fullData, error: fullErr }) => {
                    if (!fullErr && Array.isArray(fullData) && fullData.length > 0) {
                      fullData.forEach(item => addUserButterfly(item, false, true));
                    }
                  })
                  .catch(() => {});
              }
            }
          })
          .catch(() => {});
      }, 15000);
    }
  } catch (err) {}
}, 1500);

/* ========================================================
   3. 네이티브 웹캠 최적화 + 제스처 인식 (오프스크린 버퍼 & 적응형 주기)
   ======================================================== */
let activeWebcamStream = null;
let isAutoReloading = false;

setTimeout(() => {
  try {
    if (typeof Hands !== 'undefined') {
      const videoElement = document.getElementById('webcam-video');

      // 🌟 전체 화면 비디오 레이어와 WebGL 텍스처 충돌을 막기 위한 320x240 오프스크린 전용 입력 캔버스
      const handInputCanvas = document.createElement('canvas');
      handInputCanvas.width = 320;
      handInputCanvas.height = 240;
      const handInputCtx = handInputCanvas.getContext('2d', { alpha: false, desynchronized: true });

      const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
      hands.setOptions({ 
        maxNumHands: 1,
        modelComplexity: 0, 
        minDetectionConfidence: 0.45, 
        minTrackingConfidence: 0.45 
      });

      let scatterFrameCount = 0;
          
      hands.onResults((results) => {
        if (isAutoReloading) return;
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const wasHandDetected = isHandDetected;
          lastHandResultTime = performance.now();
          const lm = results.multiHandLandmarks[0];
          const wrist = lm[0];
          const tip = lm[8];

          targetScreenX = (1 - tip.x) * window.innerWidth;
          targetScreenY = tip.y * window.innerHeight;
          if (!wasHandDetected) {
            currentScreenX = targetScreenX;
            currentScreenY = targetScreenY;
          }
          handPointer.style.opacity = '1';

          _handUnprojectVec.set((1 - tip.x) * 2 - 1, -(tip.y * 2) + 1, 0.5);
          _handUnprojectVec.unproject(camera);
          _handUnprojectVec.sub(camera.position).normalize();

          const distSq = (p1, p2) => {
            const dx = p1.x - p2.x, dy = p1.y - p2.y;
            return dx * dx + dy * dy;
          };

          const isIndexOpen = distSq(lm[8], wrist) > distSq(lm[6], wrist) * 1.15;
          const isMiddleClosed = distSq(lm[12], wrist) < distSq(lm[10], wrist) * 1.15;
          const isRingClosed   = distSq(lm[16], wrist) < distSq(lm[14], wrist) * 1.15;
          const isPinkyClosed  = distSq(lm[20], wrist) < distSq(lm[18], wrist) * 1.15;

          const otherClosedCount = (isMiddleClosed ? 1 : 0) + (isRingClosed ? 1 : 0) + (isPinkyClosed ? 1 : 0);
              
          const isPointGesture = isIndexOpen && (otherClosedCount >= 2);
          const isTrueScatter = isIndexOpen && !isMiddleClosed && !isRingClosed && !isPinkyClosed && !isPointGesture;
          const isTrueFist = !isIndexOpen && isMiddleClosed && isRingClosed && isPinkyClosed;

          const prevMode = interactionMode;

          if (isPointGesture) {
              scatterFrameCount = 0;
              interactionMode = 'land_one';
              const distance = (8 - camera.position.z) / _handUnprojectVec.z; 
              targetHandPos3D.copy(camera.position).addScaledVector(_handUnprojectVec, distance);

          } else if (isTrueScatter) {
              scatterFrameCount++;
              const distance = (8 - camera.position.z) / _handUnprojectVec.z; 
              targetHandPos3D.copy(camera.position).addScaledVector(_handUnprojectVec, distance);
              if (scatterFrameCount > 2) {
                  interactionMode = 'scatter';
                  resetHandCards();
              }

          } else if (isTrueFist) {
              scatterFrameCount = 0;
              interactionMode = 'fist_gather';
              const distance = (0 - camera.position.z) / _handUnprojectVec.z; 
              targetHandPos3D.copy(camera.position).addScaledVector(_handUnprojectVec, distance);
              resetHandCards();

              if (prevMode !== 'fist_gather') {
                  const allFlock = [...defaultFlock, ...userFlock];
                  allFlock.sort((a, b) => a.group.position.distanceTo(targetHandPos3D) - b.group.position.distanceTo(targetHandPos3D));
                  fistButterflies = allFlock.slice(0, 5).map(b => b.id);
              }
          } else {
              scatterFrameCount = 0;
              interactionMode = 'none';
              fistButterflies = [];
              if (!specialButterfly) resetHandCards();
          }

          if (!wasHandDetected) {
            handTarget3D.copy(targetHandPos3D);
          }
          isHandDetected = true;
        } else {
          scatterFrameCount = 0;
          handPointer.style.opacity = '0';
          isHandDetected = false;
          interactionMode = 'none';
          fistButterflies = [];
          if (!specialButterfly) resetHandCards();
        }
      });

      let isProcessingFrame = false;
      let frameWatchdogTimer = null;
      let isVideoLoopStarted = false;
      let currentFrameId = 0; // 🌟 프레임 세대 ID (Watchdog 경쟁 상태 및 중복 루프 증식 차단)

      function processVideoLoop() {
        if (isAutoReloading) return;
        if (videoElement.paused || videoElement.ended) {
          videoElement.play().catch(() => {});
        }
        if (!isProcessingFrame && videoElement.readyState >= 2) {
          isProcessingFrame = true;
          const myFrameId = ++currentFrameId;

          // 🌟 MediaPipe 응답 멈춤(Hang) 대비 6초 Watchdog 타이머 (세대 ID 검증으로 중복 호출 방지)
          frameWatchdogTimer = setTimeout(() => {
            if (isProcessingFrame && myFrameId === currentFrameId) {
              isProcessingFrame = false;
              processVideoLoop();
            }
          }, 6000);

          handInputCtx.drawImage(videoElement, 0, 0, 320, 240);

          hands.send({ image: handInputCanvas })
            .catch(() => {})
            .finally(() => {
              // 이미 타임아웃되어 다음 루프로 넘어간 이전 요청이면 무시
              if (myFrameId !== currentFrameId) return;

              if (frameWatchdogTimer) {
                clearTimeout(frameWatchdogTimer);
                frameWatchdogTimer = null;
              }
              if (isProcessingFrame) {
                isProcessingFrame = false;
                // 🌟 손이 감지 중일 때는 80ms, 손이 없을 때는 140ms로 유휴 부하 절감
                const nextDelay = isHandDetected ? 80 : 140;
                setTimeout(processVideoLoop, nextDelay);
              }
            });
        } else {
          setTimeout(processVideoLoop, 60);
        }
      }

      function startWebcamStream() {
        if (isAutoReloading) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 360, max: 480 }, height: { ideal: 270, max: 360 }, frameRate: { ideal: 30 } },
          audio: false
        }).then((stream) => {
          if (activeWebcamStream && activeWebcamStream !== stream) {
            activeWebcamStream.getTracks().forEach((t) => {
              try { t.stop(); } catch (e) {}
            });
          }
          activeWebcamStream = stream;
          videoElement.srcObject = stream;

          // 🌟 전시 중 웹캠 USB 연결이 물리적으로 순단되었을 때 자동 재연결
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              if (!isAutoReloading) {
                console.warn("웹캠 트랙 종료 감지: 3초 후 재연결을 시도합니다.");
                setTimeout(startWebcamStream, 3000);
              }
            };
          }

          videoElement.onloadedmetadata = () => {
            videoElement.play().catch(() => {});
            if (!isVideoLoopStarted) {
              isVideoLoopStarted = true;
              processVideoLoop();
            }
          };
        }).catch((err) => {
          console.warn("웹캠 접근 실패, 5초 후 재시도:", err);
          if (!isAutoReloading) {
            setTimeout(startWebcamStream, 5000);
          }
        });
      }

      startWebcamStream();
    }
  } catch (err) {}
}, 2000);

/* ========================================================
   4. 4시간 주기 스마트 안전 자동 새로고침 시스템
   - 4시간 경과 후 즉시 새로고침하지 않고, 관람객 인터랙션/세레머니가 전혀 없고
     네트워크가 정상 연결된 조용한 틈을 기다려 안전하게 리소스를 해제한 뒤 새로고침
   ======================================================== */
const AUTO_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4시간

setTimeout(() => {
  const idleCheckInterval = setInterval(async () => {
    if (isAutoReloading) return;

    // 1. 인터넷 연결 상태 확인 (오프라인일 때 새로고침하면 에러 화면이 뜨므로 절대 새로고침하지 않음)
    if (navigator.onLine === false) return;

    // 2. 최근 10초 이내 손 인식이 없어야 함
    const timeSinceLastHand = performance.now() - lastHandResultTime;
    if (isHandDetected || timeSinceLastHand < 10000) return;

    // 3. 손가락 교감 나비 또는 세레머니 나비/대기열이 전혀 없어야 함
    if (specialButterfly || isCreatingSpecialButterfly) return;
    if (isCeremonyActive || activeCeremonyButterfly || ceremonyQueue.length > 0) return;

    // 4. 화면에 떠 있는 안내 카드가 없어야 함
    if (floatingConcernCard && floatingConcernCard.classList.contains('visible')) return;
    if (floatingInfoCard && floatingInfoCard.classList.contains('visible')) return;

    // 5. 실제 네트워크 통신이 가능한지 경량 핑 확인 (와이파이만 연결되고 인터넷이 안 되는 현상 방어)
    if (globalSupabaseInstance) {
      try {
        const { error } = await globalSupabaseInstance.from('butterflies').select('id').limit(1);
        if (error) return;
      } catch (e) {
        return;
      }
    }

    // 모든 조건 통과 후 재검증 (비동기 통신 도중 손이 인식되었거나 세레머니가 시작되었는지 한 번 더 확인)
    if (isHandDetected || (performance.now() - lastHandResultTime < 10000)) return;
    if (specialButterfly || isCreatingSpecialButterfly || isCeremonyActive || activeCeremonyButterfly || ceremonyQueue.length > 0) return;

    isAutoReloading = true;
    clearInterval(idleCheckInterval);

    // 부드러운 암전 연출 후 웹캠 및 WebGL 하드웨어 잠금 안전 해제
    document.body.style.transition = 'opacity 0.8s ease';
    document.body.style.opacity = '0';

    setTimeout(() => {
      try {
        const videoEl = document.getElementById('webcam-video');
        if (videoEl) {
          videoEl.pause();
          videoEl.srcObject = null;
        }
        if (activeWebcamStream) {
          activeWebcamStream.getTracks().forEach(track => {
            try { track.stop(); } catch (e) {}
          });
        }
      } catch (e) {}

      try {
        if (renderer) {
          renderer.dispose();
        }
      } catch (e) {}

      setTimeout(() => {
        window.location.reload();
      }, 250);
    }, 800);
  }, 5000);
}, AUTO_REFRESH_INTERVAL_MS);

/* ========================================================
   5. Screen Wake Lock API (전시 중 OS/디스플레이 절전 진입 방지)
   ======================================================== */
let screenWakeLock = null;
async function requestScreenWakeLock() {
  try {
    if ('wakeLock' in navigator && !isAutoReloading) {
      screenWakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
}
requestScreenWakeLock();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestScreenWakeLock();
  }
});
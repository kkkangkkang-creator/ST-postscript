import { SETTINGS_KEY, cleanSettings, valid, createAppender } from './core.js';

export function mountPostscript({ getContext, document, notify = () => {} }) {
    const context = getContext();
    const event = context.eventTypes?.CHAT_COMPLETION_SETTINGS_READY;
    const events = context.eventSource;
    const container = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!container) throw Error('실리태번 확장 설정 영역을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.');
    if (!context.extensionSettings || typeof context.saveSettingsDebounced !== 'function') {
        throw Error('실리태번 설정 저장 API를 사용할 수 없어요.');
    }
    const supported = Boolean(event && typeof events?.on === 'function' && typeof events?.removeListener === 'function');
    let settings = cleanSettings(context.extensionSettings[SETTINGS_KEY]);
    let alive = true;
    const append = createAppender();
    const panel = document.createElement('div');
    panel.id = 'st-postscript-settings';
    panel.innerHTML = `
      <details class="ps-drawer">
        <summary><span><b>P.S. — 추신</b><small>전송할 대화 끝에 한마디 더</small></span><span class="ps-badge">OFF</span></summary>
        <div class="ps-content">
          <label class="ps-toggle"><input type="checkbox" data-ps="enabled"><span>추신 사용</span></label>
          <p class="ps-help">일반 채팅 전송·재생성·스와이프 요청 끝에 ASSISTANT → USER 두 턴을 붙여요. 실제 채팅 기록에는 남기지 않아요.</p>
          <label class="ps-field"><span>ASSISTANT <small>직접 작성하는 예시 응답</small></span><textarea data-ps="assistant" class="text_pole" rows="5" placeholder="모델에게 보여 줄 예시 응답을 입력하세요."></textarea></label>
          <label class="ps-field"><span>USER <small>마지막으로 덧붙일 요청</small></span><textarea data-ps="user" class="text_pole" rows="5" placeholder="마지막 요청을 입력하세요."></textarea></label>
          <p class="ps-help">입력 내용은 자동 저장돼요. OFF여도 내용은 유지됩니다. {{char}}·{{user}} 등 실리태번 매크로는 전송할 때 적용돼요.</p>
          <p class="ps-status" role="status" aria-live="polite"></p>
          <details class="ps-preview"><summary>추가할 두 턴 미리보기</summary><pre></pre></details>
          <p class="ps-help">채팅 완성 API용 확장이에요. 요약·번역 등 quiet 요청, 유저 사칭, 기존 답변의 이어쓰기에는 적용하지 않아요. 입력 토큰이 추가되므로 컨텍스트 한도에 여유를 두세요.</p>
          <p class="ps-last"></p>
        </div>
      </details>`;
    const find = name => panel.querySelector(`[data-ps="${name}"]`);
    const toggle = find('enabled');
    find('assistant').value = settings.assistant;
    find('user').value = settings.user;
    function display(note = '') {
        toggle.checked = settings.enabled;
        toggle.disabled = !supported;
        panel.querySelector('.ps-badge').textContent = settings.enabled ? 'ON' : 'OFF';
        panel.querySelector('.ps-badge').classList.toggle('active', settings.enabled);
        const api = getContext().mainApi;
        panel.querySelector('.ps-status').textContent = !supported
            ? '이 실리태번 버전은 필요한 전송 이벤트를 지원하지 않아요. 업데이트가 필요해요.'
            : api && api !== 'openai'
                ? '현재 API는 채팅 완성 API가 아니어서 적용되지 않아요.'
                : note || (settings.enabled ? 'ON · 다음 일반 채팅 요청에 두 턴을 추가해요.' : 'OFF · 내용을 자동 저장했어요. 두 칸을 채운 뒤 켜 주세요.');
        panel.querySelector('.ps-preview pre').textContent = `ASSISTANT\n${settings.assistant}\n\nUSER\n${settings.user}`;
    }
    function persist() {
        const current = getContext();
        current.extensionSettings[SETTINGS_KEY] = { ...settings };
        current.saveSettingsDebounced();
    }
    const edit = e => {
        const field = e.target.dataset?.ps;
        if (field !== 'assistant' && field !== 'user') return;
        settings[field] = e.target.value;
        const wasEnabled = settings.enabled;
        if (!valid(settings)) settings.enabled = false;
        persist();
        display(wasEnabled && !settings.enabled ? '입력칸이 비어 있어 OFF로 바꿨어요. 내용을 채운 뒤 다시 켜 주세요.' : '입력 내용을 자동 저장했어요.');
    };
    const change = e => {
        if (e.target !== toggle) return;
        if (toggle.checked && !valid(settings)) {
            display('ASSISTANT와 USER 내용을 모두 입력한 뒤 켜 주세요.');
            return;
        }
        settings.enabled = toggle.checked;
        persist();
        display();
    };
    const ready = payload => {
        if (!alive) return;
        const current = getContext();
        const result = append(payload, settings, text => current.substituteParams?.(text) ?? text);
        if (result.status === 'invalid') {
            notify('추신의 두 입력칸을 확인해 주세요. 이번 요청에는 추신을 넣지 않았어요.');
        }
        if (result.status === 'applied') {
            panel.querySelector('.ps-last').textContent = `마지막 적용 ${new Date().toLocaleTimeString()} · 2개 메시지 추가`;
        } else if (result.status === 'tools') {
            panel.querySelector('.ps-last').textContent = '도구 실행 후속 요청에는 추신을 추가하지 않았어요.';
        }
    };
    panel.addEventListener('input', edit);
    panel.addEventListener('change', change);
    container.append(panel);
    if (supported) {
        if (typeof events.makeLast === 'function') events.makeLast(event, ready);
        else events.on(event, ready);
    }
    display();
    return {
        panel,
        cleanup() {
            if (!alive) return;
            alive = false;
            if (supported) events.removeListener(event, ready);
            panel.removeEventListener('input', edit);
            panel.removeEventListener('change', change);
            panel.remove();
        },
    };
}

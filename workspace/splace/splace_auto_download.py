# -*- coding: utf-8 -*-
"""
스마트플레이스 자동화 - 매일 밤 10시 (화~토)
1. 내일 날짜 전체마감
2. 확정 예약 상세 내려받기 -> 바탕화면 저장
"""
import datetime, os, glob, logging, sys
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

DESKTOP  = r'C:\Users\남혜은\Desktop'
BIZES_ID = '635147'
AUTH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'naver_auth.json')
LOG_FILE  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'splace_auto.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger()



def step1_close_all(page, tomorrow):
    log.info(f'[1단계] 전체마감 {tomorrow}')
    page.goto(f'https://partner.booking.naver.com/bizes/{BIZES_ID}/simple-management')
    page.wait_for_load_state('networkidle', timeout=15000)
    page.wait_for_timeout(1500)

    # 내일 날짜로 이동: ▶ (다음날) 버튼 클릭
    # simple-management 는 오늘 날짜로 시작 → ▶ 한 번 클릭하면 내일로 이동
    moved = page.evaluate('''() => {
        const btns = [...document.querySelectorAll('button, a')];
        const nextBtn = btns.find(b => {
            const txt = (b.textContent || '').trim();
            const cls = (b.className || '').toLowerCase();
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            return txt === '▶' || txt === '>' || txt === '›' ||
                   cls.includes('next') || aria.includes('다음') || aria.includes('next');
        });
        if (nextBtn) { nextBtn.click(); return nextBtn.textContent.trim().substring(0, 5); }
        return null;
    }''')

    if moved is not None:
        page.wait_for_timeout(2000)
        log.info(f'  내일 날짜로 이동 완료 (▶ 클릭: "{moved}")')
    else:
        log.error('  ▶ 버튼을 찾지 못함 - 계속 진행')
        page.screenshot(path=os.path.join(DESKTOP, 'debug_step1_nav.png'))
        return False

    try:
        page.get_by_role('button', name='전체마감').click(timeout=8000)
        page.wait_for_timeout(1500)
        # 확인 팝업
        try:
            page.get_by_role('button', name='확인').click(timeout=4000)
            page.wait_for_timeout(1500)
        except PWTimeout:
            try:
                page.get_by_role('button', name='마감하기').click(timeout=4000)
                page.wait_for_timeout(1500)
            except PWTimeout:
                pass
        log.info('  전체마감 완료')
        return True
    except PWTimeout:
        log.error('  전체마감 버튼 없음 (이미 마감됐을 수 있음)')
        return True


def step2_download(page, tomorrow):
    tomorrow_str = tomorrow.strftime('%Y.%m.%d')
    log.info(f'[2단계] 다운로드 {tomorrow_str} / 확정')
    page.goto(f'https://partner.booking.naver.com/bizes/{BIZES_ID}/booking-list-view')
    page.wait_for_load_state('networkidle', timeout=15000)

    # CDP로 Chrome 다운로드 위치를 Desktop으로 강제 지정 (blob URL 다운로드도 캡처)
    try:
        cdp = page.context.new_cdp_session(page)
        cdp.send('Browser.setDownloadBehavior', {
            'behavior': 'allow',
            'downloadPath': DESKTOP,
            'eventsEnabled': True,
        })
        log.info('  CDP 다운로드 경로 설정 완료')
    except Exception as e:
        log.warning(f'  CDP 설정 실패 (무시): {e}')

    # 날짜 필터: 이용일 드롭다운 → 직접설정 또는 하루
    try:
        page.get_by_role('button', name='이용일').click(timeout=5000)
        page.wait_for_timeout(800)
        try:
            page.get_by_text('직접설정', exact=True).click(timeout=3000)
        except PWTimeout:
            page.get_by_text('하루', exact=True).click(timeout=3000)
        page.wait_for_timeout(1000)
    except PWTimeout:
        pass

    try:
        inputs = page.locator('input[placeholder="YYYY.MM.DD"]').all()
        if not inputs:
            inputs = page.locator('input[placeholder="yyyy.mm.dd"]').all()
        for inp in inputs[:2]:
            inp.triple_click()
            inp.type(tomorrow_str)
            inp.press('Enter')
            page.wait_for_timeout(500)
        log.info('  날짜 입력 완료')
    except Exception as e:
        log.error(f'  날짜 입력 실패: {e}')

    page.wait_for_timeout(2000)

    # 예약상태 -> 확정 (드롭다운 방식 우선 시도)
    confirmed = False
    for btn_name in ['예약상태', '상태']:
        try:
            page.locator(f'button:has-text("{btn_name}")').first.click(timeout=4000)
            page.wait_for_timeout(800)
            page.get_by_text('확정', exact=True).first.click(timeout=4000)
            page.wait_for_timeout(2000)
            log.info('  상태 필터: 확정')
            confirmed = True
            break
        except PWTimeout:
            continue
    if not confirmed:
        try:
            page.get_by_role('button', name='확정', exact=True).click(timeout=5000)
            page.wait_for_timeout(2000)
            log.info('  상태 필터: 확정 (직접)')
        except PWTimeout:
            log.error('  상태 필터 실패 - 계속 진행')

    # 응답/새탭 감시 등록 (팝업 클릭 전)
    excel_data = []
    recent_responses = []
    new_pages = []

    def on_response(resp):
        ct = resp.headers.get('content-type', '').lower()
        url = resp.url
        recent_responses.append(f'{url[-60:]}|{ct[:40]}')
        is_excel = ('spreadsheet' in ct or 'excel' in ct or
                    url.lower().endswith('.xlsx') or url.lower().endswith('.xls') or
                    'download' in ct)
        if is_excel:
            try:
                body = resp.body()
                log.info(f'  Excel 응답 감지 {len(body)}bytes: {url[-80:]}')
                excel_data.append(body)
            except Exception as ex:
                log.warning(f'  Excel 응답 body 실패: {ex}')

    def on_new_page(np):
        new_pages.append(np)
        np.on('response', on_response)
        np.on('download', lambda d: excel_data.append(d))

    page.on('response', on_response)
    page.context.on('page', on_new_page)

    try:
        # 1) 상세 내려받기 클릭 (팝업 열림)
        page.get_by_role('button', name='상세 내려받기').click(timeout=8000)
        page.wait_for_timeout(2000)

        # 2) 팝업의 내려받기 버튼 클릭 ('상세 내려받기' 제외, 마지막 매칭)
        dl_btn = page.locator('button').filter(has_text='내려받기').filter(has_not_text='상세').last

        try:
            with page.expect_download(timeout=25000) as dl_info:
                dl_btn.click(timeout=8000)
                log.info('  내려받기 클릭')

            download = dl_info.value
            dest = os.path.join(DESKTOP, download.suggested_filename)
            download.save_as(dest)
            log.info(f'  다운로드 완료: {download.suggested_filename}')
            return True

        except Exception as e1:
            log.error(f'  expect_download 실패: {e1}')
            log.info(f'  최근 응답: {recent_responses[-8:]}')
            log.info(f'  새 탭: {[p.url for p in new_pages]}')

            # 응답 인터셉터가 Excel 바이트를 잡았으면 저장
            for item in excel_data:
                if isinstance(item, (bytes, bytearray)) and len(item) > 1000:
                    fname = f'reservation_{tomorrow.strftime("%Y%m%d")}.xlsx'
                    dest = os.path.join(DESKTOP, fname)
                    with open(dest, 'wb') as f:
                        f.write(item)
                    log.info(f'  응답 인터셉터로 저장: {fname}')
                    return True

            # 새 탭에서의 다운로드 객체 처리
            for item in excel_data:
                if hasattr(item, 'suggested_filename'):
                    dest = os.path.join(DESKTOP, item.suggested_filename)
                    item.save_as(dest)
                    log.info(f'  새 탭 다운로드 저장: {item.suggested_filename}')
                    return True

            page.screenshot(path=os.path.join(DESKTOP, 'debug_no_download.png'))
            return False

    except Exception as e:
        page.screenshot(path=os.path.join(DESKTOP, 'debug_download_fail.png'))
        log.error(f'  다운로드 실패: {e}')
        return False


def run():
    if not os.path.exists(AUTH_FILE):
        log.error('세션 파일 없음! naver_login_setup.py 를 먼저 실행하세요.')
        return

    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    log.info(f'========== 자동화 시작 {datetime.datetime.now().strftime("%Y-%m-%d %H:%M")} ==========')

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(storage_state=AUTH_FILE)
        page = context.new_page()

        try:
            step1_close_all(page, tomorrow)
            step2_download(page, tomorrow)
        except Exception as e:
            log.error(f'오류: {e}')
            page.screenshot(path=os.path.join(DESKTOP, 'splace_error.png'))
        finally:
            context.storage_state(path=AUTH_FILE)  # 세션 갱신 저장
            browser.close()

    log.info('========== 자동화 완료 ==========\n')


if __name__ == '__main__':
    run()

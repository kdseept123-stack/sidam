# -*- coding: utf-8 -*-
"""
스마트플레이스 자동화 - 매일 밤 10시 (화~토)
1. 내일 날짜 전체마감
2. 확정 예약 상세 내려받기 → 바탕화면 저장
"""
import datetime, time, os, glob, logging, sys, subprocess
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager

DESKTOP    = r'C:\Users\남혜은\Desktop'
DOWNLOADS  = os.path.join(os.path.expanduser('~'), 'Downloads')
BIZES_ID   = '635147'
CHROME_DIR = r'C:\Users\남혜은\AppData\Local\Google\Chrome\User Data'
LOG_FILE   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'splace_auto.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger()


def close_chrome():
    subprocess.run(['taskkill', '/F', '/IM', 'chrome.exe'], capture_output=True)
    time.sleep(2)


def make_driver():
    options = Options()
    options.add_argument(f'--user-data-dir={CHROME_DIR}')
    options.add_argument('--profile-directory=Default')
    options.add_argument('--no-first-run')
    options.add_argument('--no-default-browser-check')
    options.add_argument('--disable-extensions')
    options.add_experimental_option('prefs', {
        'download.default_directory': DESKTOP,
        'download.prompt_for_download': False,
        'download.directory_upgrade': True,
    })
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def step1_close_all(driver, tomorrow):
    wait = WebDriverWait(driver, 20)
    day = str(tomorrow.day)
    log.info(f'[1단계] 전체마감 — {tomorrow}')

    driver.get(f'https://partner.booking.naver.com/bizes/{BIZES_ID}/simple-management')
    time.sleep(5)

    # 내일 날짜 클릭
    try:
        cell = wait.until(EC.element_to_be_clickable((By.XPATH,
            f'//td[normalize-space(.)="{day}"]'
            f'[not(contains(@class,"disabled"))]'
            f'[not(contains(@class,"prev-month"))]'
            f'[not(contains(@class,"next-month"))]'
        )))
        cell.click()
        time.sleep(3)
        log.info(f'  날짜 선택: {day}일')
    except Exception as e:
        log.error(f'  날짜 클릭 실패: {e}')
        return False

    # 전체마감 버튼
    try:
        btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, '//button[contains(text(),"전체마감")]')
        ))
        btn.click()
        time.sleep(2)
        log.info('  전체마감 클릭')

        # 확인 팝업
        try:
            confirm = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(
                (By.XPATH, '//button[contains(text(),"확인") or contains(text(),"마감하기")]')
            ))
            confirm.click()
            time.sleep(2)
        except:
            pass
        log.info('  전체마감 완료')
        return True
    except Exception as e:
        log.error(f'  전체마감 실패: {e}')
        return False


def step2_download(driver, tomorrow):
    wait = WebDriverWait(driver, 20)
    tomorrow_str = tomorrow.strftime('%Y.%m.%d')
    log.info(f'[2단계] 예약 목록 다운로드 — {tomorrow_str} / 확정')

    driver.get(f'https://partner.booking.naver.com/bizes/{BIZES_ID}/booking-list-view')
    time.sleep(5)

    # 날짜 입력 (시작~종료 모두 내일로)
    try:
        inputs = driver.find_elements(By.XPATH,
            '//input[@placeholder="YYYY.MM.DD" or @placeholder="yyyy.mm.dd"]'
        )
        for inp in inputs[:2]:
            inp.click()
            inp.send_keys(Keys.CONTROL + 'a')
            inp.send_keys(tomorrow_str)
            inp.send_keys(Keys.ENTER)
            time.sleep(1)
        log.info(f'  날짜 입력 완료')
    except Exception as e:
        log.error(f'  날짜 입력 실패: {e}')

    time.sleep(2)

    # 예약상태 → 확정
    try:
        status_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, '//button[contains(.,"예약상태")]')
        ))
        status_btn.click()
        time.sleep(1)

        confirmed = wait.until(EC.element_to_be_clickable(
            (By.XPATH, '//*[self::li or self::span or self::label][normalize-space(.)="확정"]')
        ))
        confirmed.click()
        time.sleep(2)
        log.info('  상태 필터: 확정')
    except Exception as e:
        log.error(f'  상태 필터 실패: {e}')

    # 상세 내려받기
    try:
        dl_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, '//button[contains(text(),"상세 내려받기") or contains(text(),"상세내려받기")]')
        ))
        dl_btn.click()
        log.info('  다운로드 시작...')
        time.sleep(10)
    except Exception as e:
        log.error(f'  다운로드 버튼 실패: {e}')
        return False

    # 파일 확인 (바탕화면 우선, 없으면 Downloads에서 이동)
    pattern_desk = os.path.join(DESKTOP, '시간을담다베이커리_예약자관리_*.xlsx')
    files = sorted(glob.glob(pattern_desk), key=os.path.getmtime, reverse=True)
    if files:
        log.info(f'  저장 완료: {os.path.basename(files[0])}')
        return True

    pattern_dl = os.path.join(DOWNLOADS, '시간을담다베이커리_예약자관리_*.xlsx')
    files = sorted(glob.glob(pattern_dl), key=os.path.getmtime, reverse=True)
    if files:
        dest = os.path.join(DESKTOP, os.path.basename(files[0]))
        os.replace(files[0], dest)
        log.info(f'  바탕화면으로 이동: {os.path.basename(dest)}')
        return True

    log.warning('  파일을 찾지 못했습니다 — 수동 확인 필요')
    return False


def run():
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    log.info(f'========== 자동화 시작 {datetime.datetime.now().strftime("%Y-%m-%d %H:%M")} ==========')

    close_chrome()

    driver = None
    try:
        driver = make_driver()
        step1_close_all(driver, tomorrow)
        step2_download(driver, tomorrow)
    except Exception as e:
        log.error(f'오류: {e}')
    finally:
        if driver:
            driver.quit()

    log.info('========== 자동화 완료 ==========\n')


if __name__ == '__main__':
    run()

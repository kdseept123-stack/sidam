# -*- coding: utf-8 -*-
import tkinter as tk
import threading

COUNTDOWN = 30  # 초

def show_alert():
    root = tk.Tk()
    root.title('⚠ 크롬 종료 필요')
    root.configure(bg='#1a1a2e')
    root.resizable(False, False)
    root.attributes('-topmost', True)

    # 화면 중앙 배치
    w, h = 420, 200
    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()
    root.geometry(f'{w}x{h}+{(sw-w)//2}+{sh-h-60}')  # 화면 하단 중앙

    tk.Label(root, text='⚠  10분 후 자동화 실행',
             font=('맑은 고딕', 14, 'bold'), fg='#ff6b35', bg='#1a1a2e').pack(pady=(24, 6))

    tk.Label(root, text='스마트플레이스 자동 다운로드가 10분 후 시작됩니다.\n지금 크롬을 닫아주세요!',
             font=('맑은 고딕', 11), fg='white', bg='#1a1a2e', justify='center').pack(pady=4)

    countdown_var = tk.StringVar(value=f'{COUNTDOWN}초 후 자동 닫힘')
    tk.Label(root, textvariable=countdown_var,
             font=('맑은 고딕', 9), fg='#aaaacc', bg='#1a1a2e').pack(pady=6)

    tk.Button(root, text='확인 (닫기)', command=root.destroy,
              font=('맑은 고딕', 10, 'bold'), bg='#ff6b35', fg='white',
              relief='flat', padx=20, pady=6, cursor='hand2').pack()

    remaining = [COUNTDOWN]
    def tick():
        remaining[0] -= 1
        if remaining[0] <= 0:
            root.destroy()
        else:
            countdown_var.set(f'{remaining[0]}초 후 자동 닫힘')
            root.after(1000, tick)

    root.after(1000, tick)
    root.mainloop()

if __name__ == '__main__':
    show_alert()

import win32print

ESC = b'\x1b'
GS  = b'\x1d'
test_data = (
    ESC + b'@' +
    ESC + b'a\x01' +
    b'== TEST ==\n' +
    b'COM4 ESC/POS\n' +
    b'==========\n' +
    b'\n\n\n' +
    GS + b'V\x41\x00'
)

for printer in [r'\\172.30.1.82\receipt', 'SLK-TS100 (copy 1)']:
    print(f"Testing: {printer}")
    try:
        hp = win32print.OpenPrinter(printer)
        win32print.StartDocPrinter(hp, 1, ('Test', None, 'RAW'))
        win32print.StartPagePrinter(hp)
        n = win32print.WritePrinter(hp, test_data)
        win32print.EndPagePrinter(hp)
        win32print.EndDocPrinter(hp)
        win32print.ClosePrinter(hp)
        print(f"  -> {n}bytes 전송됨 - 종이 확인하세요")
    except Exception as e:
        print(f"  -> 실패: {e}")

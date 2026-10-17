// 기본 HTML 없이 쓰는 공통 메이크코드 (버전 3, 2026-10-16 실물 검증)
// 사용 전 꼭: 다운로드한 뒤 MakeCode 탭을 닫거나 '연결 해제'하세요.
//   MakeCode가 연결된 채로 있으면 시리얼 데이터를 같이 가져가서 웹앱에 글자가 빠진 채 도착합니다.
// 확장: robotbit (KittenBot) 하나만 추가하세요. neopixel은 robotbit에 들어 있습니다.
//   neopixel을 따로 추가하면 "호환되지 않습니다" 창이 뜹니다. (2026-10-16 메이크코드에서 확인)
// 서보 S1 / 외장 네오픽셀 P15 (6개) / 초음파 Trig P14, Echo P13
// 이 코드는 센서값을 보내고, 받은 명령대로만 움직입니다. 작동 조건은 웹앱이 판단합니다.
//
// 장치 → 웹 (0.2초마다)
//   D,거리,흔들림,밝기,온도,A버튼,B버튼,앞뒤기울기,좌우기울기
//   거리 cm(-1 = 측정 실패) / 흔들림 mg / 밝기 0~255 / 온도 ℃
//   버튼 0·1 / 앞뒤기울기·좌우기울기 도(-180~180)
// 웹 → 장치
//   S,각도            서보 S1 (0~180)
//   L,빨강,초록,파랑    네오픽셀 전체 한 색 (각 0~255, L,0,0,0 = 끄기)
//   P,번호,빨강,초록,파랑  네오픽셀 한 개 (번호 0~5)
//   B,밝기            네오픽셀 밝기 (0~255)
//   R                 무지개색
//   T                 색을 한 칸씩 옆으로 돌리기 (반복해서 보내면 움직이는 효과)
let PIXEL_COUNT = 6
let strip = neopixel.create(DigitalPin.P15, PIXEL_COUNT, NeoPixelMode.RGB)
// 블록 변환 후에도 사라지지 않도록 배열을 값 6개로 바로 만듭니다.
let pixelColors = [0, 0, 0, 0, 0, 0]
strip.setBrightness(40)
strip.clear()
strip.show()
serial.redirectToUSB()
serial.setBaudRate(BaudRate.BaudRate115200)
// 버퍼 크기는 기본값을 씁니다. (setTxBufferSize를 넣었을 때 깨짐이 늘었던 측정이 있어 넣지 않습니다.)
pins.setPull(DigitalPin.P13, PinPullMode.PullNone)
function clampNumber(value: number, low: number, high: number) {
    if (!(value >= low)) return low
    if (value > high) return high
    return value
}
// 밝기는 색을 칠할 때 적용되므로, 저장해 둔 색으로 매번 다시 칠합니다.
function renderPixels() {
    for (let i = 0; i < PIXEL_COUNT; i++) {
        strip.setPixelColor(i, pixelColors[i])
    }
    strip.show()
}
function toColor(red: string, green: string, blue: string) {
    return neopixel.rgb(
        clampNumber(parseInt(red), 0, 255),
        clampNumber(parseInt(green), 0, 255),
        clampNumber(parseInt(blue), 0, 255))
}
// 명령 받기 이벤트(serial.onDataReceived) 대신, 반복문에서 받은 글자를 직접 꺼내 와
// 줄바꿈 단위로 명령을 실행합니다. 이 방식으로 실물 검증을 마쳤습니다.
let receivedText = ""
function readCommands() {
    receivedText = receivedText + serial.readString()
    let newline = receivedText.indexOf("\n")
    while (newline >= 0) {
        runCommand(receivedText.substr(0, newline))
        receivedText = receivedText.substr(newline + 1, receivedText.length)
        newline = receivedText.indexOf("\n")
    }
    // 줄바꿈 없이 너무 길어지면 잘못 들어온 글자로 보고 버립니다.
    if (receivedText.length > 100) {
        receivedText = ""
    }
}
function runCommand(line: string) {
    let fields = line.split(",")
    let command = fields[0].charAt(0)
    if (command == "S" && fields.length == 2) {
        let target = parseInt(fields[1])
        if (target >= 0 && target <= 180) {
            robotbit.Servo(robotbit.Servos.S1, target)
        }
    } else if (command == "L" && fields.length == 4) {
        let color = toColor(fields[1], fields[2], fields[3])
        for (let i = 0; i < PIXEL_COUNT; i++) {
            pixelColors[i] = color
        }
        renderPixels()
    } else if (command == "P" && fields.length == 5) {
        let index = parseInt(fields[1])
        if (index >= 0 && index < PIXEL_COUNT) {
            pixelColors[index] = toColor(fields[2], fields[3], fields[4])
            renderPixels()
        }
    } else if (command == "B" && fields.length == 2) {
        strip.setBrightness(clampNumber(parseInt(fields[1]), 0, 255))
        renderPixels()
    } else if (command == "R") {
        for (let i = 0; i < PIXEL_COUNT; i++) {
            pixelColors[i] = neopixel.hsl(i * 360 / PIXEL_COUNT, 100, 50)
        }
        renderPixels()
    } else if (command == "T") {
        let last = pixelColors.pop()
        pixelColors.unshift(last)
        renderPixels()
    }
}
// 명령은 0.02초마다 확인하고, 센서 데이터는 0.2초마다 보냅니다.
// 받는 곳의 기본 크기가 작아서, 명령을 자주 꺼내 와야 넘치지 않습니다.
let lastSend = 0
basic.forever(function () {
    readCommands()
    if (input.runningTime() - lastSend >= 200) {
        lastSend = input.runningTime()
        sendSensors()
    }
    basic.pause(20)
})
function sendSensors() {
    pins.digitalWritePin(DigitalPin.P14, 0)
    control.waitMicros(2)
    pins.digitalWritePin(DigitalPin.P14, 1)
    control.waitMicros(10)
    pins.digitalWritePin(DigitalPin.P14, 0)
    let pulse = pins.pulseIn(DigitalPin.P13, PulseValue.High, 25000)
    let cm = Math.round(pulse / 58)
    let distance = pulse > 0 && cm >= 2 && cm <= 400 ? cm : -1
    let ax = input.acceleration(Dimension.X)
    let ay = input.acceleration(Dimension.Y)
    let az = input.acceleration(Dimension.Z)
    let motion = Math.round(Math.abs(Math.sqrt(ax * ax + ay * ay + az * az) - 1024))
    let brightness = input.lightLevel()
    let temperature = input.temperature()
    let buttonA = input.buttonIsPressed(Button.A) ? 1 : 0
    let buttonB = input.buttonIsPressed(Button.B) ? 1 : 0
    let pitch = input.rotation(Rotation.Pitch)
    let roll = input.rotation(Rotation.Roll)
    serial.writeLine("D," + distance + "," + motion + "," + brightness + "," + temperature + "," + buttonA + "," + buttonB + "," + pitch + "," + roll)
}
basic.showIcon(IconNames.Yes)

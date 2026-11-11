package kr.damounlab.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Moa-on 안드로이드 설치 앱(D-228). 화면은 운영 웹을 그대로 연다(capacitor.config.json server.url).
// 이 앱이 하는 일: 알림 채널 만들기 — 채널 이름은 서버(src/lib/push/fcm.ts fcmChannel)와 같아야 한다.
//  - chat: 채팅·회의 알림. 중요도 높음(화면 위에 크게), 길게 세 번 진동, 기본 알림음
//  - general: 그 밖의 알림(결재 완료·정산 등). 보통 중요도
// 안드로이드는 채널을 한 번 만들면 진동·소리를 앱이 바꿀 수 없다(사용자가 휴대폰 설정에서 바꿈) — 바꾸려면 새 채널 이름을 쓴다.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createChannels();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        AudioAttributes audio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        NotificationChannel chat = new NotificationChannel("chat", "채팅", NotificationManager.IMPORTANCE_HIGH);
        chat.setDescription("채팅 새 메시지·회의 알림");
        chat.enableVibration(true);
        chat.setVibrationPattern(new long[] { 0, 500, 200, 500, 200, 500 });
        chat.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audio);
        chat.enableLights(true);
        chat.setLightColor(0xFF4F46E5);
        chat.setShowBadge(true);
        nm.createNotificationChannel(chat);

        NotificationChannel general = new NotificationChannel("general", "업무 알림", NotificationManager.IMPORTANCE_DEFAULT);
        general.setDescription("결재·정산·마감·공지 알림");
        general.enableVibration(true);
        general.setVibrationPattern(new long[] { 0, 400, 200, 400 });
        general.setShowBadge(true);
        nm.createNotificationChannel(general);
    }
}

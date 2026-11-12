import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

// 아이폰 설치 앱(D-259, spec/features/ios-app.md) — 운영 웹을 그대로 열고, 알림만 FCM(안드로이드와 같은 서버 경로)으로 받는다.
// 아이폰 기기 주소(APNs 토큰)를 Firebase에 넘겨 FCM 토큰으로 바꾼 뒤, 그 FCM 토큰을 웹(PushNotifications 'registration')에 준다.
// 그래서 서버(src/lib/push/fcm.ts)는 안드로이드와 똑같이 FCM으로만 보낸다.
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // GoogleService-Info.plist(Firebase 콘솔 아이폰 앱 설정 파일)가 있을 때만 켠다 — 없으면 알림만 안 되고 앱은 열린다
        // (빈 파일이면 — 설정 파일 없이 만든 확인용 빌드 — 켜지 않는다: GOOGLE_APP_ID가 있어야 함)
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let dict = NSDictionary(contentsOfFile: path), dict["GOOGLE_APP_ID"] != nil {
            FirebaseApp.configure()
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard FirebaseApp.app() != nil else {
            NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: NSError(domain: "moaon", code: 1, userInfo: [NSLocalizedDescriptionKey: "Firebase not configured"]))
            return
        }
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            } else if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

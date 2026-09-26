import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "vi";

const STORAGE_KEY = "oclaunch.lang";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.myProjects": "My projects",
  "nav.reviewInbox": "Review inbox",
  "nav.discover": "Discover",
  "nav.account": "Account",
  "nav.workspace": "Workspace",
  "nav.signIn": "Sign in",
  "nav.logOut": "Log out",
  "nav.menu": "Menu",
  "nav.close": "Close",
  "nav.overview": "Overview",
  "nav.reviews": "Reviews",
  "nav.improvements": "Improvements",
  "nav.reports": "Reports",
  "nav.settings": "Settings",
  "nav.language": "Language",
  "lang.en": "English",
  "lang.vi": "Tiếng Việt",

  "home.tagline": "Build. Review. Improve.",
  "home.headline": "Your next release, better together.",
  "home.support":
    "Get useful feedback on your app, preview improvements, and keep a clear record of what got better.",
  "home.cta.add": "Add your project",
  "home.cta.review": "Review a project",
  "home.footer.by": "A community project by Orangecloud · launch.orangecloud.vn",
  "home.footer.tagline": "Build. Review. Improve.",
  "home.example.label": "Example loop · fictional demo product",
  "home.example.capture": "Capture release",
  "home.example.captureBody": "Freeze a URL, viewport, and ruleset version.",
  "home.example.review": "Focused review",
  "home.example.reviewBody": "“Create your first weekly plan without help.”",
  "home.example.improve": "Improve with evidence",
  "home.example.improveBody": "Accept findings and export tasks for your coding agent.",
  "home.example.verify": "Verify & report",
  "home.example.verifyBody": "Record what got better before the next release.",

  "signin.title": "Sign in to OCLaunch",
  "signin.subtitle":
    "Passkeys are the primary identity. GitHub sign-in does not grant repository access.",
  "signin.displayName": "Display name",
  "signin.localDev": "Local development",
  "signin.localDevBody":
    "Fastest path on this machine: continue without a hardware authenticator. Disabled when APP_ENV=production.",
  "signin.continueLocal": "Continue as local founder",
  "signin.createPasskey": "Create passkey",
  "signin.signInPasskey": "Sign in with passkey",
  "signin.recovery": "Recovery code",
  "signin.recoveryPlaceholder": "Single-use code from passkey registration",
  "signin.redeem": "Redeem recovery code",
  "signin.error": "Could not complete sign-in",

  "workspace.title": "My projects",
  "workspace.subtitle": "Continue the next useful action in your improvement loop.",
  "workspace.add": "Add your project",
  "workspace.inbox": "Review inbox",
  "workspace.openMissions": "open",
  "workspace.mission": "mission",
  "workspace.missions": "missions",
  "workspace.emptyTitle": "No projects yet",
  "workspace.emptyBody":
    "Create a project to capture releases, request focused reviews, and track verified improvements.",
  "workspace.next.capture": "Capture a release",
  "workspace.next.triage": "Triage open findings",
  "workspace.next.awaiting": "Awaiting mission reviews",
  "workspace.next.export": "Request a review or export improvements",
  "workspace.latest": "Latest",
  "workspace.noRelease": "No release yet",
  "workspace.release": "release",
  "workspace.releases": "releases",
  "workspace.next": "Next",

  "discover.title": "Discover review requests",
  "discover.subtitle": "Opt-in public projects only. Visibility defaults to private.",
  "discover.openInbox": "Open review inbox",
  "discover.signInReview": "Sign in to review",
  "discover.emptyTitle": "No public projects yet",
  "discover.emptyBody":
    "Sign in to open the review inbox, or add your project and set visibility to public.",
  "discover.openMissions": "open mission",
  "discover.openMissionsPlural": "open missions",
  "discover.noMissions": "No open missions",
  "discover.review": "Review",

  "project.new.title": "Add your project",
  "project.new.subtitle": "Visibility defaults to private. Public directory listing is opt-in.",
  "project.new.name": "Name",
  "project.new.slug": "Slug",
  "project.new.purpose": "Purpose",
  "project.new.audience": "Target audience",
  "project.new.primaryTask": "Primary user task",
  "project.new.primaryTaskPh": "Create your first weekly plan without help",
  "project.new.liveUrl": "Live URL",
  "project.new.visibility": "Visibility",
  "project.new.private": "Private",
  "project.new.unlisted": "Unlisted (passport link only)",
  "project.new.public": "Public (discoverable)",
  "project.new.create": "Create project",
  "project.new.error": "Could not create project",

  "inbox.title": "Review inbox",
  "inbox.subtitle":
    "Open public and unlisted missions, excluding your own projects and prior reviews.",
  "inbox.emptyTitle": "No matching missions right now",
  "inbox.emptyBody":
    "When founders open public review requests, they appear here with fair waiting-time ordering.",
  "inbox.browseDiscover": "Browse Discover",
  "inbox.submit": "Submit review",
  "inbox.openApp": "Open app",
  "inbox.submitted": "Review submitted",
  "inbox.submittedBody": "Credit recorded for useful feedback — praise is not required.",
  "inbox.reviewHeading": "Review",
  "inbox.tried": "What you tried",
  "inbox.expected": "What you expected",
  "inbox.stuck": "Where you got stuck",
  "inbox.observations": "Observations",
  "inbox.audienceFit": "Audience fit",
  "inbox.outcome": "Outcome",
  "inbox.fit.target": "Target user",
  "inbox.fit.peer": "Peer reviewer",
  "inbox.fit.unknown": "Unknown",
  "inbox.out.completed": "Completed",
  "inbox.out.withHelp": "Completed with help",
  "inbox.out.couldNot": "Could not complete",
  "inbox.out.notAttempted": "Not attempted",
  "inbox.audience": "audience",
  "inbox.cancel": "Cancel",

  "invite.unavailable": "Invite unavailable",
  "invite.loading": "Loading invite…",
  "invite.instructions": "Mission instructions",
  "invite.openTarget": "Open target app in new tab",
  "invite.signInTitle": "Sign in to submit",
  "invite.signInBody": "Sign in first. Project owners cannot self-review.",
  "invite.selfBlockedTitle": "Self-review is blocked",
  "invite.selfBlockedBody":
    "You own this project. Share the invite with someone else, or open Review inbox for other founders’ missions. Working alone? Log a founder note on the release instead.",
  "invite.submittedTitle": "Review submitted",
  "invite.submittedBody":
    "Thank you. Useful critical feedback earns recognition — praise is not required.",
  "invite.prompt": "What happened, what did you expect, and where did you get stuck?",
  "invite.submitError": "Could not submit",

  "common.loading": "Loading…",
  "common.error": "Error",
  "common.update": "Update",
  "common.cancel": "Cancel",
  "common.done": "done",
  "common.todo": "todo",
  "common.saved": "Saved.",
  "common.next": "Next",

  "findings.title": "Findings",
  "findings.accept": "Accept",
  "findings.needEvidence": "Need evidence",
  "findings.dismiss": "Dismiss",
  "findings.dismissWhy": "Why dismiss this finding?",
  "findings.markImplemented": "Mark implemented",
  "findings.markVerified": "Mark verified",
  "findings.propose": "Propose improvement",
  "findings.loopDone": "Loop step complete",
  "findings.outcome": "Outcome",
  "findings.tried": "Tried",
  "findings.expected": "Expected",
  "findings.stuck": "Stuck",
  "findings.observations": "Observations",
  "findings.criterion": "Criterion",
  "findings.emptyTitle": "No findings yet",
  "findings.emptyBody": "Run automated checks, log a founder note, or invite a reviewer.",

  "release.openApp": "Open app in new tab",
  "release.runAutomated": "Run automated checks",
  "release.generateReport": "Generate report",
  "release.invite": "Invite a reviewer",
  "release.evidenceUploaded": "Evidence uploaded",
  "release.founderNote": "Log a founder note",
  "release.founderNoteBody":
    "Working alone? Capture friction yourself, accept it, export an improvement, then verify.",
  "release.whatBetter": "What should get better",
  "release.whatObserved": "What you observed",
  "release.category": "Category",
  "release.addFinding": "Add finding",
  "release.uploadEvidence": "Upload release evidence (image / text / JSON, max 2MB)",
  "release.verifiedNote":
    "Verification recorded — preview success is not claimed as production proof.",

  "reports.title": "Release reports",
  "reports.subtitle":
    "Immutable snapshots for deciding what to improve next. No universal readiness score.",
  "reports.open": "Open report",
  "reports.share": "Create redacted share link",
  "reports.compare": "Compare latest two releases",
  "reports.compareNeedTwo": "Need at least two releases to compare.",
  "reports.emptyTitle": "No reports yet",
  "reports.emptyBody":
    "Generate a report from a release workspace after reviews or automated checks.",
  "reports.notFound": "Report not found",
  "reports.notFoundBody":
    "This report id is missing or you do not have access. Open Reports from the project nav.",
  "reports.shareCreated": "Share created",
  "reports.comparison": "Release comparison",
  "reports.new": "New",
  "reports.improved": "Improved",
  "reports.none": "none",
  "reports.release": "Release",
  "reports.humanReview": "human review",
  "reports.humanReviews": "human reviews",
  "reports.openRelease": "Open release",
  "reports.createShare": "Create redacted share",
  "reports.loading": "Loading report…",
  "reports.captured": "Captured",
  "reports.ruleset": "ruleset",
  "reports.environment": "Environment",
  "reports.tried": "tried",
  "reports.envGapTitle": "Reviewed URL is not the live URL",
  "reports.envGapWarn": "Do not claim production verification from a localhost or preview try.",
  "reports.snapshotTitle": "Evidence-based snapshot",
  "reports.snapshotDefault":
    "No universal readiness score. Coverage and concrete outcomes only.",
  "reports.humanOutcomes": "Human outcomes",
  "reports.sampleSize": "Sample size",
  "reports.noCommunity": "No community reviews attached to this release yet.",
  "reports.reopened": "Reopened & not rechecked",
  "reports.reopenedNone":
    "No reopened findings and no prior verified titles missing from this release.",
  "reports.reopenedItem": "Reopened",
  "reports.notRechecked": "Verified previously, not rechecked",
  "reports.untested": "Untested scope",
  "reports.nextThree": "Next three actions",
  "reports.verified": "Verified",
  "reports.stillOpen": "Still open",
  "reports.humanObs": "Human observations",
  "reports.findingsHumanFirst": "Findings (human first)",
  "reports.noFindingsSnap": "No findings in this snapshot",
  "reports.noFindingsSnapBody": "Generate again after reviews.",
  "reports.previous": "Previous release context",
  "reports.shareRevocable": "revocable; screenshots omitted by default.",
  "reports.live": "Live",

  "settings.title": "Project settings",
  "settings.subtitle":
    "Set visibility to public or unlisted so peers can find missions on Discover / Review inbox.",
  "settings.visibility": "Visibility",
  "settings.liveUrl": "Live URL",
  "settings.audience": "Audience",
  "settings.primaryTask": "Primary user task",
  "settings.save": "Save settings",
  "settings.private": "Private",
  "settings.unlisted": "Unlisted",
  "settings.public": "Public",
  "passport.private":
    "Passport is public only — set visibility to public or unlisted in Settings.",

  "overview.guided": "Guided improvement loop",
  "overview.nextSolo":
    "solo founders can finish without a second account by logging a note or running automated checks on a release.",
  "overview.latest": "Latest release",
  "overview.emptyReleaseTitle": "Add a release to start tracking improvements.",
  "overview.emptyReleaseBody":
    "Reviews always point to a frozen release URL and capture time — never an undefined “latest” screen.",
  "overview.triedOn": "Tried on",
  "overview.openWorkspace": "Open release workspace",
  "overview.shareMissions": "Share review missions",
  "overview.runAutomated": "Run automated checks",
  "overview.blocked": "Action blocked",
  "overview.capture": "Capture release",
  "overview.captureBody":
    "Freezes five dangerous-path missions automatically. Record where a human will try it — preview success is not production proof.",
  "overview.label": "Label",
  "overview.sourceUrl": "Source URL (frozen snapshot)",
  "overview.whereTry": "Where a human will try it",
  "overview.urlOpen": "URL they will open",
  "overview.commit": "Commit / deploy id (optional)",
  "overview.freeze": "Freeze snapshot",
  "overview.step.release": "Capture a frozen release",
  "overview.step.review": "Collect evidence (review or founder note)",
  "overview.step.triage": "Triage and accept findings",
  "overview.step.improve": "Propose / export an improvement",
  "overview.step.verify": "Mark implemented and verify live",
  "overview.step.report": "Generate a release report",
  "overview.cta.openLatest": "Open latest release",
  "overview.cta.openRelease": "Open release",
  "overview.cta.openReviews": "Open reviews",
  "overview.cta.triageOpen": "Triage open",
  "overview.cta.studio": "Improvement studio",
  "overview.cta.verifyRelease": "Verify on release",
  "overview.cta.verifyFindings": "Verify findings",
  "overview.cta.viewReports": "View reports",
  "overview.cta.goReports": "Go to reports",

  "changes.title": "Improvement studio",
  "changes.subtitle":
    "Export a task bundle for your coding agent. Sandbox preview + draft PR stay integration_not_configured until credentials exist.",
  "changes.baseSha": "Base commit SHA",
  "changes.baseShaPh": "Paste the commit SHA from your repo",
  "changes.accepted": "Accepted findings",
  "changes.acceptedEmptyTitle": "No accepted findings ready to propose",
  "changes.acceptedEmptyBody":
    "Accept findings on a release first. Findings already in a change set stay on that studio page.",
  "changes.propose": "Propose change set",
  "changes.sets": "Change sets",
  "changes.setsEmptyTitle": "None yet",
  "changes.setsEmptyBody": "Proposed improvements will appear here.",
  "changes.openStudio": "Open change studio",
  "changes.quickExport": "Quick export",
  "changes.baseShaError": "Paste a real base commit SHA (at least 7 characters).",
  "changes.exportReady": "Agent export ready — open the change studio to copy it.",
};

const vi: Dict = {
  "nav.myProjects": "Dự án của tôi",
  "nav.reviewInbox": "Hộp thư đánh giá",
  "nav.discover": "Khám phá",
  "nav.account": "Tài khoản",
  "nav.workspace": "Không gian làm việc",
  "nav.signIn": "Đăng nhập",
  "nav.logOut": "Đăng xuất",
  "nav.menu": "Menu",
  "nav.close": "Đóng",
  "nav.overview": "Tổng quan",
  "nav.reviews": "Đánh giá",
  "nav.improvements": "Cải tiến",
  "nav.reports": "Báo cáo",
  "nav.settings": "Cài đặt",
  "nav.language": "Ngôn ngữ",
  "lang.en": "English",
  "lang.vi": "Tiếng Việt",

  "home.tagline": "Build. Review. Improve.",
  "home.headline": "Bản phát hành tiếp theo của bạn, tốt hơn cùng nhau.",
  "home.support":
    "Nhận phản hồi hữu ích về ứng dụng, xem trước cải tiến và giữ hồ sơ rõ ràng về những gì đã tốt hơn.",
  "home.cta.add": "Thêm dự án",
  "home.cta.review": "Đánh giá một dự án",
  "home.footer.by": "Dự án cộng đồng của Orangecloud · launch.orangecloud.vn",
  "home.footer.tagline": "Build. Review. Improve.",
  "home.example.label": "Vòng lặp ví dụ · sản phẩm demo hư cấu",
  "home.example.capture": "Chốt bản phát hành",
  "home.example.captureBody": "Đóng băng URL, viewport và phiên bản ruleset.",
  "home.example.review": "Đánh giá có trọng tâm",
  "home.example.reviewBody": "“Tạo kế hoạch tuần đầu tiên mà không cần trợ giúp.”",
  "home.example.improve": "Cải tiến kèm bằng chứng",
  "home.example.improveBody": "Chấp nhận phát hiện và xuất nhiệm vụ cho coding agent của bạn.",
  "home.example.verify": "Xác minh & báo cáo",
  "home.example.verifyBody": "Ghi lại điều đã tốt hơn trước bản phát hành tiếp theo.",

  "signin.title": "Đăng nhập OCLaunch",
  "signin.subtitle":
    "Passkey là danh tính chính. Đăng nhập GitHub không cấp quyền truy cập kho mã.",
  "signin.displayName": "Tên hiển thị",
  "signin.localDev": "Môi trường phát triển cục bộ",
  "signin.localDevBody":
    "Cách nhanh trên máy này: tiếp tục không cần khóa phần cứng. Tắt khi APP_ENV=production.",
  "signin.continueLocal": "Tiếp tục với tư cách founder cục bộ",
  "signin.createPasskey": "Tạo passkey",
  "signin.signInPasskey": "Đăng nhập bằng passkey",
  "signin.recovery": "Mã khôi phục",
  "signin.recoveryPlaceholder": "Mã dùng một lần khi đăng ký passkey",
  "signin.redeem": "Dùng mã khôi phục",
  "signin.error": "Không hoàn tất đăng nhập",

  "workspace.title": "Dự án của tôi",
  "workspace.subtitle": "Tiếp tục hành động hữu ích tiếp theo trong vòng cải tiến.",
  "workspace.add": "Thêm dự án",
  "workspace.inbox": "Hộp thư đánh giá",
  "workspace.openMissions": "đang mở",
  "workspace.mission": "nhiệm vụ",
  "workspace.missions": "nhiệm vụ",
  "workspace.emptyTitle": "Chưa có dự án",
  "workspace.emptyBody":
    "Tạo dự án để chốt bản phát hành, mời đánh giá có trọng tâm và theo dõi cải tiến đã xác minh.",
  "workspace.next.capture": "Chốt một bản phát hành",
  "workspace.next.triage": "Phân loại phát hiện đang mở",
  "workspace.next.awaiting": "Đang chờ đánh giá nhiệm vụ",
  "workspace.next.export": "Mời đánh giá hoặc xuất cải tiến",
  "workspace.latest": "Mới nhất",
  "workspace.noRelease": "Chưa có bản phát hành",
  "workspace.release": "bản phát hành",
  "workspace.releases": "bản phát hành",
  "workspace.next": "Tiếp theo",

  "discover.title": "Khám phá yêu cầu đánh giá",
  "discover.subtitle": "Chỉ dự án công khai chọn tham gia. Mặc định là riêng tư.",
  "discover.openInbox": "Mở hộp thư đánh giá",
  "discover.signInReview": "Đăng nhập để đánh giá",
  "discover.emptyTitle": "Chưa có dự án công khai",
  "discover.emptyBody":
    "Đăng nhập để mở hộp thư đánh giá, hoặc thêm dự án và đặt hiển thị công khai.",
  "discover.openMissions": "nhiệm vụ đang mở",
  "discover.openMissionsPlural": "nhiệm vụ đang mở",
  "discover.noMissions": "Không có nhiệm vụ mở",
  "discover.review": "Đánh giá",

  "project.new.title": "Thêm dự án",
  "project.new.subtitle": "Mặc định là riêng tư. Hiển thị công khai là tùy chọn.",
  "project.new.name": "Tên",
  "project.new.slug": "Slug",
  "project.new.purpose": "Mục đích",
  "project.new.audience": "Đối tượng mục tiêu",
  "project.new.primaryTask": "Nhiệm vụ chính của người dùng",
  "project.new.primaryTaskPh": "Tạo kế hoạch tuần đầu tiên mà không cần trợ giúp",
  "project.new.liveUrl": "URL trực tiếp",
  "project.new.visibility": "Hiển thị",
  "project.new.private": "Riêng tư",
  "project.new.unlisted": "Không liệt kê (chỉ liên kết passport)",
  "project.new.public": "Công khai (khám phá được)",
  "project.new.create": "Tạo dự án",
  "project.new.error": "Không tạo được dự án",

  "inbox.title": "Hộp thư đánh giá",
  "inbox.subtitle":
    "Nhiệm vụ công khai/không liệt kê, loại trừ dự án của bạn và lần đánh giá trước.",
  "inbox.emptyTitle": "Chưa có nhiệm vụ phù hợp",
  "inbox.emptyBody":
    "Khi founder mở yêu cầu đánh giá công khai, chúng xuất hiện ở đây theo thứ tự công bằng.",
  "inbox.browseDiscover": "Xem Khám phá",
  "inbox.submit": "Gửi đánh giá",
  "inbox.openApp": "Mở ứng dụng",
  "inbox.submitted": "Đã gửi đánh giá",
  "inbox.submittedBody": "Đã ghi nhận tín dụng cho phản hồi hữu ích — không bắt buộc khen ngợi.",
  "inbox.reviewHeading": "Đánh giá",
  "inbox.tried": "Bạn đã thử gì",
  "inbox.expected": "Bạn mong đợi gì",
  "inbox.stuck": "Bạn bị kẹt ở đâu",
  "inbox.observations": "Quan sát",
  "inbox.audienceFit": "Phù hợp đối tượng",
  "inbox.outcome": "Kết quả",
  "inbox.fit.target": "Người dùng mục tiêu",
  "inbox.fit.peer": "Người đánh giá đồng nghiệp",
  "inbox.fit.unknown": "Không rõ",
  "inbox.out.completed": "Hoàn thành",
  "inbox.out.withHelp": "Hoàn thành với trợ giúp",
  "inbox.out.couldNot": "Không hoàn thành được",
  "inbox.out.notAttempted": "Chưa thử",
  "inbox.audience": "đối tượng",
  "inbox.cancel": "Hủy",

  "invite.unavailable": "Lời mời không khả dụng",
  "invite.loading": "Đang tải lời mời…",
  "invite.instructions": "Hướng dẫn nhiệm vụ",
  "invite.openTarget": "Mở ứng dụng đích trong tab mới",
  "invite.signInTitle": "Đăng nhập để gửi",
  "invite.signInBody": "Hãy đăng nhập trước. Chủ dự án không thể tự đánh giá.",
  "invite.selfBlockedTitle": "Tự đánh giá bị chặn",
  "invite.selfBlockedBody":
    "Bạn sở hữu dự án này. Chia sẻ lời mời cho người khác, hoặc mở Hộp thư đánh giá cho nhiệm vụ của founder khác. Làm một mình? Ghi chú founder trên bản phát hành.",
  "invite.submittedTitle": "Đã gửi đánh giá",
  "invite.submittedBody":
    "Cảm ơn bạn. Phản hồi phê bình hữu ích được ghi nhận — không bắt buộc khen ngợi.",
  "invite.prompt": "Điều gì đã xảy ra, bạn mong đợi gì, và bạn bị kẹt ở đâu?",
  "invite.submitError": "Không gửi được",

  "common.loading": "Đang tải…",
  "common.error": "Lỗi",
  "common.update": "Cập nhật",
  "common.cancel": "Hủy",
  "common.done": "xong",
  "common.todo": "cần làm",
  "common.saved": "Đã lưu.",
  "common.next": "Tiếp theo",

  "findings.title": "Phát hiện",
  "findings.accept": "Chấp nhận",
  "findings.needEvidence": "Cần thêm bằng chứng",
  "findings.dismiss": "Bỏ qua",
  "findings.dismissWhy": "Vì sao bỏ qua phát hiện này?",
  "findings.markImplemented": "Đánh dấu đã triển khai",
  "findings.markVerified": "Đánh dấu đã xác minh",
  "findings.propose": "Đề xuất cải tiến",
  "findings.loopDone": "Bước vòng lặp hoàn tất",
  "findings.outcome": "Kết quả",
  "findings.tried": "Đã thử",
  "findings.expected": "Mong đợi",
  "findings.stuck": "Bị kẹt",
  "findings.observations": "Quan sát",
  "findings.criterion": "Tiêu chí",
  "findings.emptyTitle": "Chưa có phát hiện",
  "findings.emptyBody":
    "Chạy kiểm tra tự động, ghi chú founder, hoặc mời người đánh giá.",

  "release.openApp": "Mở ứng dụng trong tab mới",
  "release.runAutomated": "Chạy kiểm tra tự động",
  "release.generateReport": "Tạo báo cáo",
  "release.invite": "Mời người đánh giá",
  "release.evidenceUploaded": "Đã tải bằng chứng",
  "release.founderNote": "Ghi chú founder",
  "release.founderNoteBody":
    "Làm một mình? Ghi lại ma sát, chấp nhận, xuất cải tiến, rồi xác minh.",
  "release.whatBetter": "Điều cần tốt hơn",
  "release.whatObserved": "Bạn quan sát thấy gì",
  "release.category": "Danh mục",
  "release.addFinding": "Thêm phát hiện",
  "release.uploadEvidence": "Tải bằng chứng bản phát hành (ảnh / văn bản / JSON, tối đa 2MB)",
  "release.verifiedNote":
    "Đã ghi nhận xác minh — thành công trên preview không được coi là bằng chứng production.",

  "reports.title": "Báo cáo phát hành",
  "reports.subtitle":
    "Ảnh chụp bất biến để quyết định cải tiến tiếp theo. Không có điểm sẵn sàng phổ quát.",
  "reports.open": "Mở báo cáo",
  "reports.share": "Tạo liên kết chia sẻ đã che",
  "reports.compare": "So sánh hai bản phát hành mới nhất",
  "reports.compareNeedTwo": "Cần ít nhất hai bản phát hành để so sánh.",
  "reports.emptyTitle": "Chưa có báo cáo",
  "reports.emptyBody":
    "Tạo báo cáo từ không gian bản phát hành sau khi có đánh giá hoặc kiểm tra tự động.",
  "reports.notFound": "Không tìm thấy báo cáo",
  "reports.notFoundBody":
    "Id báo cáo không tồn tại hoặc bạn không có quyền. Mở Báo cáo từ thanh điều hướng dự án.",
  "reports.shareCreated": "Đã tạo liên kết chia sẻ",
  "reports.comparison": "So sánh bản phát hành",
  "reports.new": "Mới",
  "reports.improved": "Đã cải thiện",
  "reports.none": "không có",
  "reports.release": "Bản phát hành",
  "reports.humanReview": "đánh giá con người",
  "reports.humanReviews": "đánh giá con người",
  "reports.openRelease": "Mở bản phát hành",
  "reports.createShare": "Tạo liên kết chia sẻ đã che",
  "reports.loading": "Đang tải báo cáo…",
  "reports.captured": "Đã chụp",
  "reports.ruleset": "ruleset",
  "reports.environment": "Môi trường",
  "reports.tried": "đã thử",
  "reports.envGapTitle": "URL đã thử không phải URL live",
  "reports.envGapWarn":
    "Không tuyên bố xác minh production từ thử nghiệm localhost hoặc preview.",
  "reports.snapshotTitle": "Ảnh chụp dựa trên bằng chứng",
  "reports.snapshotDefault":
    "Không có điểm sẵn sàng phổ quát. Chỉ độ phủ và kết quả cụ thể.",
  "reports.humanOutcomes": "Kết quả từ con người",
  "reports.sampleSize": "Cỡ mẫu",
  "reports.noCommunity": "Chưa có đánh giá cộng đồng gắn với bản phát hành này.",
  "reports.reopened": "Mở lại & chưa kiểm tra lại",
  "reports.reopenedNone":
    "Không có phát hiện mở lại và không có tiêu đề đã xác minh trước đó bị thiếu.",
  "reports.reopenedItem": "Đã mở lại",
  "reports.notRechecked": "Đã xác minh trước, chưa kiểm tra lại",
  "reports.untested": "Phạm vi chưa thử",
  "reports.nextThree": "Ba hành động tiếp theo",
  "reports.verified": "Đã xác minh",
  "reports.stillOpen": "Vẫn mở",
  "reports.humanObs": "Quan sát con người",
  "reports.findingsHumanFirst": "Phát hiện (ưu tiên con người)",
  "reports.noFindingsSnap": "Không có phát hiện trong ảnh chụp này",
  "reports.noFindingsSnapBody": "Tạo lại sau khi có đánh giá.",
  "reports.previous": "Ngữ cảnh bản phát hành trước",
  "reports.shareRevocable": "có thể thu hồi; mặc định bỏ ảnh chụp màn hình.",
  "reports.live": "Live",

  "settings.title": "Cài đặt dự án",
  "settings.subtitle":
    "Đặt hiển thị công khai hoặc không liệt kê để đồng nghiệp tìm thấy nhiệm vụ trên Khám phá / Hộp thư đánh giá.",
  "settings.visibility": "Hiển thị",
  "settings.liveUrl": "URL trực tiếp",
  "settings.audience": "Đối tượng",
  "settings.primaryTask": "Nhiệm vụ chính của người dùng",
  "settings.save": "Lưu cài đặt",
  "settings.private": "Riêng tư",
  "settings.unlisted": "Không liệt kê",
  "settings.public": "Công khai",
  "passport.private":
    "Passport chỉ công khai — đặt hiển thị công khai hoặc không liệt kê trong Cài đặt.",

  "overview.guided": "Vòng cải tiến có hướng dẫn",
  "overview.nextSolo":
    "founder làm một mình có thể hoàn tất bằng ghi chú hoặc chạy kiểm tra tự động trên bản phát hành.",
  "overview.latest": "Bản phát hành mới nhất",
  "overview.emptyReleaseTitle": "Thêm bản phát hành để bắt đầu theo dõi cải tiến.",
  "overview.emptyReleaseBody":
    "Đánh giá luôn trỏ tới URL và thời điểm chụp cố định — không dùng màn hình “mới nhất” mơ hồ.",
  "overview.triedOn": "Đã thử trên",
  "overview.openWorkspace": "Mở không gian bản phát hành",
  "overview.shareMissions": "Chia sẻ nhiệm vụ đánh giá",
  "overview.runAutomated": "Chạy kiểm tra tự động",
  "overview.blocked": "Hành động bị chặn",
  "overview.capture": "Chốt bản phát hành",
  "overview.captureBody":
    "Tự động đóng băng năm nhiệm vụ đường nguy hiểm. Ghi nơi người dùng sẽ thử — thành công trên preview không phải bằng chứng production.",
  "overview.label": "Nhãn",
  "overview.sourceUrl": "URL nguồn (ảnh chụp đóng băng)",
  "overview.whereTry": "Nơi người dùng sẽ thử",
  "overview.urlOpen": "URL họ sẽ mở",
  "overview.commit": "Id commit / deploy (tuỳ chọn)",
  "overview.freeze": "Đóng băng ảnh chụp",
  "overview.step.release": "Chốt bản phát hành đóng băng",
  "overview.step.review": "Thu thập bằng chứng (đánh giá hoặc ghi chú founder)",
  "overview.step.triage": "Phân loại và chấp nhận phát hiện",
  "overview.step.improve": "Đề xuất / xuất cải tiến",
  "overview.step.verify": "Đánh dấu đã triển khai và xác minh live",
  "overview.step.report": "Tạo báo cáo phát hành",
  "overview.cta.openLatest": "Mở bản phát hành mới nhất",
  "overview.cta.openRelease": "Mở bản phát hành",
  "overview.cta.openReviews": "Mở đánh giá",
  "overview.cta.triageOpen": "Phân loại đang mở",
  "overview.cta.studio": "Xưởng cải tiến",
  "overview.cta.verifyRelease": "Xác minh trên bản phát hành",
  "overview.cta.verifyFindings": "Xác minh phát hiện",
  "overview.cta.viewReports": "Xem báo cáo",
  "overview.cta.goReports": "Đến báo cáo",

  "changes.title": "Xưởng cải tiến",
  "changes.subtitle":
    "Xuất gói nhiệm vụ cho coding agent. Sandbox preview + draft PR vẫn integration_not_configured cho đến khi có credential.",
  "changes.baseSha": "Base commit SHA",
  "changes.baseShaPh": "Dán commit SHA từ kho mã của bạn",
  "changes.accepted": "Phát hiện đã chấp nhận",
  "changes.acceptedEmptyTitle": "Chưa có phát hiện sẵn để đề xuất",
  "changes.acceptedEmptyBody":
    "Hãy chấp nhận phát hiện trên bản phát hành trước. Phát hiện đã trong change set nằm trên trang xưởng đó.",
  "changes.propose": "Đề xuất change set",
  "changes.sets": "Change set",
  "changes.setsEmptyTitle": "Chưa có",
  "changes.setsEmptyBody": "Các cải tiến đề xuất sẽ hiện ở đây.",
  "changes.openStudio": "Mở xưởng change",
  "changes.quickExport": "Xuất nhanh",
  "changes.baseShaError": "Dán một base commit SHA thật (ít nhất 7 ký tự).",
  "changes.exportReady": "Xuất agent đã sẵn sàng — mở xưởng change để sao chép.",
};

const catalogs: Record<Lang, Dict> = { en, vi };

type I18nCtx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "vi" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = typeof window === "undefined" ? "en" : readStoredLang();
    if (typeof document !== "undefined") {
      document.documentElement.lang = initial === "vi" ? "vi" : "en";
    }
    return initial;
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "vi" ? "vi" : "en";
    }
  }, []);

  const t = useCallback(
    (key: string) => catalogs[lang][key] ?? catalogs.en[key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n outside LanguageProvider");
  return ctx;
}

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-ink">
      <span className={compact ? "sr-only" : "hidden sm:inline"}>{t("nav.language")}</span>
      <select
        className="min-h-[40px] max-w-[7.5rem] rounded-[10px] border border-border bg-surface px-2 text-sm font-semibold text-ink"
        value={lang}
        aria-label={t("nav.language")}
        onChange={(e) => setLang(e.target.value as Lang)}
      >
        <option value="en">{t("lang.en")}</option>
        <option value="vi">{t("lang.vi")}</option>
      </select>
    </label>
  );
}

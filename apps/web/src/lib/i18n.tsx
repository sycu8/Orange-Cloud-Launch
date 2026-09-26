import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { homeEn, homeVi } from "./home-copy";

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
  "home.example.improveBody": "Accept the problems, then copy a fix note.",
  "home.example.verify": "Verify & report",
  "home.example.verifyBody": "Record what got better before the next release.",

  "signin.title": "Sign in to OCLaunch",
  "signin.subtitle":
    "Passkeys are the primary identity. GitHub sign-in does not grant repository access.",
  "signin.displayName": "Display name",
  "signin.localDev": "Local development",
  "signin.localDevBody":
    "Works only on this machine when the local secret matches. It opens a dedicated local user and does not look up a display name.",
  "signin.localSecret": "Local secret",
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
    "Open public missions, excluding your own projects and prior reviews. Unlisted missions need an invite link.",
  "inbox.emptyTitle": "No matching missions right now",
  "inbox.emptyBody":
    "When founders open public review requests, they appear here with fair waiting-time ordering.",
  "inbox.browseDiscover": "Browse Discover",
  "inbox.submit": "Submit review",
  "inbox.openApp": "Open passport",
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
    "No universal readiness score. Human task results first; deterministic fetch notes are not human outcomes.",
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
  "overview.step.improve": "Hand off a fix",
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
    "Choose the problems you already accepted, then hand them to the tool or person who builds your product. You do not need a commit code to start.",
  "changes.step1": "1. Choose the problems to fix.",
  "changes.step2": "2. Copy the fix note into your coding tool, or send it to your developer.",
  "changes.step3": "3. When the fix is on the live site, mark it live and check the release.",
  "changes.choose": "1. Choose what to fix",
  "changes.chooseHint": "Choose at least one problem to start.",
  "changes.versionOptional": "I have a version code (optional)",
  "changes.versionHelp":
    "Only fill this in if someone gave you a commit code. Leave it blank if you are not sure.",
  "changes.versionPh": "Paste a version code if you have one",
  "changes.acceptedEmptyTitle": "Nothing is ready to fix yet",
  "changes.acceptedEmptyBody":
    "Accept a problem on a release first. Problems already in a fix stay on that fix page.",
  "changes.goRelease": "Go to the latest release",
  "changes.start": "Start this fix",
  "changes.listTitle": "Fixes you started",
  "changes.setsEmptyTitle": "No fixes yet",
  "changes.setsEmptyBody":
    "Choose accepted problems and start a fix. You do not need a commit code.",
  "changes.continue": "Continue this fix",
  "changes.problem": "problem",
  "changes.problems": "problems",
  "changes.unconnected": "Not tied to a code version",
  "changes.versionPrefix": "Version",
  "changes.untitled": "Fix",
  "changes.baseShaError": "A version code needs at least 7 characters, or leave it blank.",
  "changes.loadFailed": "Could not load the studio",
  "changes.back": "Improvements",
  "changes.fixTitle": "Hand off this fix",
  "changes.fixLead":
    "Read the problems, copy the note, and paste it where your project gets edited.",
  "changes.whatTitle": "1. What you are fixing",
  "changes.whatEmptyTitle": "No problems attached",
  "changes.whatEmptyBody": "This fix does not include any accepted problems.",
  "changes.doneWhen": "Done when:",
  "changes.handTitle": "2. Connect it to your builder",
  "changes.handBody":
    "Copy the note below. Paste it into Cursor, ChatGPT, or a message to the person who edits your project.",
  "changes.connectTitle": "No code host is connected",
  "changes.connectBody":
    "OCLaunch will not open a pull request for you yet. Copying this note is how you ship today. A missing connection is never shown as a success.",
  "changes.copyNote": "Copy fix note",
  "changes.savePacket": "Save the full packet",
  "changes.download": "Download the full packet",
  "changes.noteLabel": "Fix note",
  "changes.noteHint":
    "The note is written so a coding tool can follow it. Your problem titles stay as you wrote them.",
  "changes.copied": "Fix note copied. Paste it into the tool or chat that edits your project.",
  "changes.copyFailed": "Could not copy automatically. Select the note and copy it yourself.",
  "changes.packetReady": "Full packet saved. Download it if your tool wants the file.",
  "changes.openPreview": "Open preview",
  "changes.openDraft": "Open draft change",
  "changes.liveTitle": "3. Mark it live",
  "changes.liveBody":
    "When people can use the fix on the live site, mark it done. Then check the release. A preview is not proof the live site changed.",
  "changes.markLive": "This fix is live",
  "changes.alreadyLive": "Already marked live",
  "changes.markedLive": "Marked live. Check it on the release.",
  "changes.checkRelease": "Check it on the release",
  "changes.versionAdd": "Add the version that shipped (optional)",
  "changes.versionAddHelp": "Leave this blank if you do not have a version code.",
  "changes.tech": "Technical details",
  "changes.techBody":
    "A direct preview or draft change needs a code-host connection that is not set up. Use the fix note until then.",
  "changes.recordId": "Record",
  "changes.requestPreview": "Ask for a preview",
  "changes.previewBlocked":
    "A preview is not available yet. Copy the fix note, ship it from your project, then mark it live.",
  "changes.previewRequested": "Preview requested.",
  "changes.unavailable": "This fix is unavailable",
  "changes.loading": "Loading this fix…",
  "changes.state.proposed": "Ready to hand off",
  "changes.state.exported": "Fix note saved",
  "changes.state.awaiting_integration": "Waiting on a code connection",
  "changes.state.implemented": "Marked live",
  "changes.state.approved_for_merge": "Approved",
  "changes.state.accepted": "Accepted",
  "changes.state.change_proposed": "In this fix",
  "changes.state.verified": "Checked",
  "changes.state.observed": "Noted",
  "changes.state.triaged": "Reviewed",
  "changes.state.needs_evidence": "Needs more detail",
  "changes.state.dismissed": "Dismissed",
  "changes.state.reopened": "Reopened",
  "changes.state.verification_pending": "Waiting to be checked",
  ...homeEn,
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
  "home.example.improveBody": "Chấp nhận vấn đề, rồi sao chép ghi chú sửa.",
  "home.example.verify": "Xác minh & báo cáo",
  "home.example.verifyBody": "Ghi lại điều đã tốt hơn trước bản phát hành tiếp theo.",

  "signin.title": "Đăng nhập OCLaunch",
  "signin.subtitle":
    "Passkey là danh tính chính. Đăng nhập GitHub không cấp quyền truy cập kho mã.",
  "signin.displayName": "Tên hiển thị",
  "signin.localDev": "Môi trường phát triển cục bộ",
  "signin.localDevBody":
    "Chỉ hoạt động trên máy này khi bí mật cục bộ khớp. Mở một người dùng cục bộ riêng và không tìm theo tên hiển thị.",
  "signin.localSecret": "Bí mật cục bộ",
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
    "Nhiệm vụ công khai, loại trừ dự án của bạn và lần đánh giá trước. Nhiệm vụ không liệt kê cần liên kết mời.",
  "inbox.emptyTitle": "Chưa có nhiệm vụ phù hợp",
  "inbox.emptyBody":
    "Khi founder mở yêu cầu đánh giá công khai, chúng xuất hiện ở đây theo thứ tự công bằng.",
  "inbox.browseDiscover": "Xem Khám phá",
  "inbox.submit": "Gửi đánh giá",
  "inbox.openApp": "Mở passport",
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
    "Không có điểm sẵn sàng phổ quát. Kết quả nhiệm vụ của con người trước; ghi chú fetch xác định không phải kết quả từ con người.",
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
  "overview.step.improve": "Giao việc sửa",
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
    "Chọn các vấn đề bạn đã chấp nhận, rồi giao cho công cụ hoặc người đang xây sản phẩm. Bạn không cần mã commit để bắt đầu.",
  "changes.step1": "1. Chọn vấn đề cần sửa.",
  "changes.step2": "2. Sao chép ghi chú sửa vào công cụ code, hoặc gửi cho người xây sản phẩm.",
  "changes.step3": "3. Khi bản sửa đã lên trang đang chạy, đánh dấu đã chạy và kiểm tra bản phát hành.",
  "changes.choose": "1. Chọn việc cần sửa",
  "changes.chooseHint": "Hãy chọn ít nhất một vấn đề để bắt đầu.",
  "changes.versionOptional": "Tôi có mã phiên bản (không bắt buộc)",
  "changes.versionHelp":
    "Chỉ điền nếu ai đó đưa bạn mã commit. Nếu bạn không chắc, hãy để trống.",
  "changes.versionPh": "Dán mã phiên bản nếu bạn có",
  "changes.acceptedEmptyTitle": "Chưa có việc nào sẵn để sửa",
  "changes.acceptedEmptyBody":
    "Hãy chấp nhận một vấn đề trên bản phát hành trước. Việc đã nằm trong một bản sửa sẽ hiện ở trang đó.",
  "changes.goRelease": "Đến bản phát hành mới nhất",
  "changes.start": "Bắt đầu bản sửa này",
  "changes.listTitle": "Các bản sửa đã bắt đầu",
  "changes.setsEmptyTitle": "Chưa có bản sửa",
  "changes.setsEmptyBody":
    "Chọn vấn đề đã chấp nhận rồi bắt đầu một bản sửa. Bạn không cần mã commit.",
  "changes.continue": "Tiếp tục bản sửa",
  "changes.problem": "vấn đề",
  "changes.problems": "vấn đề",
  "changes.unconnected": "Chưa gắn với một phiên bản code",
  "changes.versionPrefix": "Phiên bản",
  "changes.untitled": "Bản sửa",
  "changes.baseShaError": "Mã phiên bản cần ít nhất 7 ký tự, hoặc để trống.",
  "changes.loadFailed": "Không tải được xưởng cải tiến",
  "changes.back": "Cải tiến",
  "changes.fixTitle": "Giao bản sửa này",
  "changes.fixLead": "Đọc các vấn đề, sao chép ghi chú, rồi dán vào nơi dự án được sửa.",
  "changes.whatTitle": "1. Việc bạn đang sửa",
  "changes.whatEmptyTitle": "Không có vấn đề nào",
  "changes.whatEmptyBody": "Bản sửa này không gồm vấn đề đã chấp nhận nào.",
  "changes.doneWhen": "Xong khi:",
  "changes.handTitle": "2. Nối với người sửa",
  "changes.handBody":
    "Sao chép ghi chú bên dưới. Dán vào Cursor, ChatGPT, hoặc tin nhắn cho người đang sửa dự án.",
  "changes.connectTitle": "Chưa nối với kho mã",
  "changes.connectBody":
    "OCLaunch chưa mở pull request giúp bạn. Sao chép ghi chú này là cách đưa bản sửa đi hôm nay. Thiếu kết nối sẽ không được hiện như đã thành công.",
  "changes.copyNote": "Sao chép ghi chú sửa",
  "changes.savePacket": "Lưu gói đầy đủ",
  "changes.download": "Tải gói đầy đủ",
  "changes.noteLabel": "Ghi chú sửa",
  "changes.noteHint":
    "Ghi chú được viết để công cụ code làm theo. Tiêu đề vấn đề giữ nguyên lời bạn đã viết.",
  "changes.copied": "Đã sao chép ghi chú sửa. Hãy dán vào công cụ hoặc cuộc trò chuyện đang sửa dự án.",
  "changes.copyFailed": "Không sao chép tự động được. Hãy chọn ghi chú và sao chép thủ công.",
  "changes.packetReady": "Đã lưu gói đầy đủ. Hãy tải về nếu công cụ của bạn cần tệp.",
  "changes.openPreview": "Mở bản xem trước",
  "changes.openDraft": "Mở bản thay đổi nháp",
  "changes.liveTitle": "3. Đánh dấu đã chạy",
  "changes.liveBody":
    "Khi mọi người dùng được bản sửa trên trang đang chạy, hãy đánh dấu xong. Rồi kiểm tra bản phát hành. Bản xem trước không chứng minh trang đang chạy đã đổi.",
  "changes.markLive": "Bản sửa này đã chạy",
  "changes.alreadyLive": "Đã đánh dấu chạy",
  "changes.markedLive": "Đã đánh dấu chạy. Hãy kiểm tra trên bản phát hành.",
  "changes.checkRelease": "Kiểm tra trên bản phát hành",
  "changes.versionAdd": "Thêm phiên bản đã đưa lên (không bắt buộc)",
  "changes.versionAddHelp": "Để trống nếu bạn không có mã phiên bản.",
  "changes.tech": "Chi tiết kỹ thuật",
  "changes.techBody":
    "Bản xem trước hoặc thay đổi nháp cần một kết nối kho mã chưa được thiết lập. Hãy dùng ghi chú sửa cho đến lúc đó.",
  "changes.recordId": "Hồ sơ",
  "changes.requestPreview": "Xin bản xem trước",
  "changes.previewBlocked":
    "Chưa có bản xem trước. Hãy sao chép ghi chú sửa, đưa lên từ dự án của bạn, rồi đánh dấu đã chạy.",
  "changes.previewRequested": "Đã xin bản xem trước.",
  "changes.unavailable": "Không mở được bản sửa này",
  "changes.loading": "Đang tải bản sửa…",
  "changes.state.proposed": "Sẵn sàng giao",
  "changes.state.exported": "Đã lưu ghi chú sửa",
  "changes.state.awaiting_integration": "Đang chờ nối kho mã",
  "changes.state.implemented": "Đã đánh dấu chạy",
  "changes.state.approved_for_merge": "Đã duyệt",
  "changes.state.accepted": "Đã chấp nhận",
  "changes.state.change_proposed": "Trong bản sửa này",
  "changes.state.verified": "Đã kiểm tra",
  "changes.state.observed": "Đã ghi nhận",
  "changes.state.triaged": "Đã xem",
  "changes.state.needs_evidence": "Cần thêm chi tiết",
  "changes.state.dismissed": "Đã bỏ qua",
  "changes.state.reopened": "Mở lại",
  "changes.state.verification_pending": "Đang chờ kiểm tra",
  ...homeVi,
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

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const q = new URLSearchParams(window.location.search).get("lang");
  if (q === "vi" || q === "en") return q;
  return readStoredLang();
}

function writeLangInUrl(lang: Lang) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = readInitialLang();
    try {
      localStorage.setItem(STORAGE_KEY, initial);
    } catch {
      /* ignore */
    }
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
    writeLangInUrl(next);
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

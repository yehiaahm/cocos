import { useSyncExternalStore } from 'react';

/**
 * Dashboard language (Arabic ⇄ English).
 *
 * - The choice is remembered per device in localStorage and defaults to Arabic.
 * - `en` is the source of truth for the keys; `ar` must contain every key (the compiler enforces it).
 * - A key with an `_one` twin is pluralised: `t('x', { n })` picks `x_one` when n === 1.
 * - Customer-facing text (WhatsApp messages) is deliberately NOT translated: customers are Arabic speakers.
 */
export type Lang = 'ar' | 'en';

const STORAGE_KEY = 'coco-admin-lang';

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'ar') return v;
  } catch {
    /* storage blocked (private mode) — fall back to Arabic */
  }
  return 'ar';
}

let current: Lang = readStored();
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;
export const dirOf = (lang: Lang = current): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');
/** Physical text alignment of the *start* edge, for blocks that force `dir="ltr"` inside the page direction. */
export const startAlign = (): 'right' | 'left' => (current === 'ar' ? 'right' : 'left');

export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* not persisted — still applies for this visit */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Re-renders the calling component whenever the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'ar' as Lang);
}

/** Hook form of `t`: subscribes the component to language changes. */
export function useT() {
  useLang();
  return t;
}

const en = {
  // Shell
  'nav.home': 'Home',
  'nav.orders': 'Orders',
  'nav.products': 'Products',
  'nav.customers': 'Customers',
  'nav.settings': 'Settings',
  'app.dashboard': 'Dashboard',
  'app.menu': 'Menu',
  'app.viewShop': 'View shop',
  'app.shopShort': 'Shop ↗',
  'app.signOut': 'Sign out',
  'lang.switch': 'Switch language',

  // Common
  'common.egp': 'EGP',
  'common.search': 'Search',
  'common.retry': 'Try again',
  'common.all': 'All',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.saved': 'Saved ✓',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.error': 'Something went wrong',
  'common.price': 'Price',
  'time.now': 'Just now',

  // API errors (client-side) and known server messages
  'api.network': "Couldn't reach the server — check your internet connection",
  'api.generic': 'Something went wrong, please try again',
  'srv.invalidUpdates': 'Invalid updates',
  'srv.unknownProduct': 'Unknown product: ',
  'srv.pushOff': 'Notifications are not enabled on the server (VAPID keys)',
  'srv.badSubscription': 'Invalid subscription',
  'srv.orderNotFound': 'Order not found',
  'srv.badStatus': 'Invalid status',
  'srv.badPaymentStatus': 'Invalid payment status',
  'srv.itemNotFound': 'Item not found in this order',
  'srv.noImage': 'No image',

  // Order status / payment
  'status.new': 'New',
  'status.confirmed': 'Confirmed',
  'status.in_progress': 'In progress',
  'status.shipped': 'Shipped',
  'status.delivered': 'Delivered',
  'status.cancelled': 'Cancelled',
  'pay.unpaid': 'Unpaid',
  'pay.pending_review': 'Receipt to review',
  'pay.paid': 'Paid',
  'pay.refunded': 'Refunded',
  'method.cod': 'Cash on delivery',
  'method.instapay': 'InstaPay',
  'method.wallet': 'Mobile wallet',

  // Dashboard
  'dash.title': 'Welcome 👋',
  'dash.sub': 'Sales and orders summary',
  'dash.period': 'Period',
  'dash.range7': '7 days',
  'dash.range30': '30 days',
  'dash.range90': '90 days',
  'dash.new': 'New',
  'dash.act.new': 'New orders awaiting confirmation',
  'dash.act.proofs': 'Transfer receipts to review',
  'dash.act.noTotal': 'Orders without a total',
  'dash.kpi.orders': 'Orders',
  'dash.kpi.vsPrev': 'vs previous period',
  'dash.kpi.revenue': 'Sales',
  'dash.kpi.paid': 'Paid: {amount}',
  'dash.kpi.avg': 'Average order',
  'dash.kpi.avgHint': 'Priced orders only',
  'dash.kpi.customers': 'Customers',
  'dash.kpi.returning': '{n} returning customers',
  'dash.kpi.returning_one': '1 returning customer',
  'dash.chart.orders': 'Orders per day',
  'dash.chart.revenue': 'Sales per day',
  'dash.metric': 'Metric',
  'dash.metric.orders': 'Orders',
  'dash.metric.revenue': 'Sales',
  'dash.top': 'Best sellers',
  'dash.allProducts': 'All products →',
  'dash.noOrders': 'No orders in this period yet',
  'dash.pieces': '{n} pcs',
  'dash.pieces_one': '1 pc',
  'dash.cities': 'Top cities',
  'dash.ordersN': '{n} orders',
  'dash.ordersN_one': '1 order',
  'dash.statuses': 'Order statuses',
  'dash.methods': 'Payment methods',
  'dash.pricing': 'Product pricing',
  'dash.pricingHint': 'Products with a price show it to customers and are totalled automatically in orders.',
  'dash.setPrices': 'Set prices',

  // Orders list
  'orders.title': 'Orders',
  'orders.count': '{n} orders',
  'orders.count_one': '1 order',
  'orders.search': 'Order no., name, phone, city',
  'orders.reviewReceipts': 'Receipts to review',
  'orders.noMatch': 'No orders match this filter',
  'orders.none': 'No orders yet',
  'orders.noneHint': "As soon as a customer orders from the site it will appear here, and you'll get a notification.",
  'orders.clear': 'Clear filters',
  'orders.items': '{n} pcs',
  'orders.items_one': '1 pc',
  'orders.col.order': 'Order',
  'orders.col.customer': 'Customer',
  'orders.col.city': 'City',
  'orders.col.items': 'Items',
  'orders.col.payment': 'Payment',
  'orders.col.status': 'Status',
  'orders.col.total': 'Total',
  'orders.col.time': 'Time',
  'orders.pages': 'Pages',
  'orders.prev': 'Previous',
  'orders.next': 'Next',

  // Order detail
  'od.back': 'Orders',
  'od.next.confirmed': 'Confirm order',
  'od.next.in_progress': 'Start working on it',
  'od.next.shipped': 'Mark as shipped',
  'od.next.delivered': 'Mark as delivered',
  'od.print': 'Print',
  'od.items': 'Items ({n} pcs)',
  'od.items_one': 'Items (1 pc)',
  'od.personalisation': 'Name: “{v}”',
  'od.unitPriceFor': 'Unit price for {name}',
  'od.subtotal': 'Subtotal',
  'od.delivery': 'Delivery',
  'od.total': 'Total',
  'od.savePrices': 'Save prices',
  'od.payment': 'Payment',
  'od.proofAlt': 'Transfer screenshot',
  'od.proofZoom': 'Click the image to enlarge',
  'od.confirmPayment': 'Confirm payment received',
  'od.rejectProof': 'Reject receipt',
  'od.change': 'Change:',
  'od.history': 'Order history',
  'od.customer': 'Customer',
  'od.repeat': 'Repeat customer · {n} orders',
  'od.call': 'Call',
  'od.address': 'Address',
  'od.customerNotes': 'Customer notes',
  'od.copyShipping': 'Copy shipping details',
  'od.messages': 'Ready-made customer messages',
  'od.messagesHint': 'Opens WhatsApp with a ready-written message (in Arabic) containing the order details and tracking link.',
  'od.msg.confirm': 'Confirm order & total',
  'od.msg.making': 'Order in progress',
  'od.msg.shipped': 'Shipped',
  'od.msg.thanks': 'Thank-you after delivery',
  'od.copyLink': 'Copy order tracking link',
  'od.internalNotes': 'Internal notes',
  'od.notesPlaceholder': 'e.g. Customer wants a slightly darker colour',
  'od.saveNote': 'Save note',
  'od.status': 'Status',
  'od.confirmCancel': 'Cancel this order?',
  'event.created': 'Order received from the website',
  'event.proof': 'Customer uploaded the transfer screenshot',
  'event.status': 'Status: {from} → {to}',
  'event.payment': 'Payment: {from} → {to}',
  'event.total': 'Total: {n} EGP',
  'event.pricesUpdated': 'Prices updated',

  // Customers
  'cust.title': 'Customers',
  'cust.count': '{n} customers',
  'cust.count_one': '1 customer',
  'cust.search': 'Name, phone, city',
  'cust.noMatch': 'No customers match this search',
  'cust.none': 'No customers yet',
  'cust.noneHint': 'Customers appear here automatically from orders.',
  'cust.repeat': 'Repeat',
  'cust.orders': 'Orders',
  'cust.spent': 'Total',
  'cust.last': 'Last order',
  'cust.whatsapp': 'WhatsApp',
  'cust.call': 'Call {name}',
  'cust.ordersLink': 'Orders',

  // Products
  'prod.title': 'Products',
  'prod.sub': '{priced} of {total} products have a price · Changes show on the site within a minute',
  'prod.name': 'Product name',
  'prod.category': 'Category',
  'prod.allCategories': 'All categories',
  'prod.filter.unpriced': 'No price',
  'prod.filter.soldout': 'Sold out',
  'prod.filter.hidden': 'Hidden',
  'prod.empty': 'No products match this filter',
  'prod.colors': '{n} colours',
  'prod.colors_one': '1 colour',
  'prod.sold': '{n} sold',
  'prod.priceOf': 'Price of {name}',
  'prod.soldOutOf': '{name} sold out',
  'prod.hide': 'Hide {name}',
  'prod.unsaved': '{n} unsaved changes',
  'prod.unsaved_one': '1 unsaved change',
  'prod.savedMsg': 'Saved ✓ — the site will update within a minute',
  'prod.undo': 'Undo',
  'prod.ok': 'OK',

  // Settings
  'set.title': 'Settings',
  'push.title': 'Order notifications on your phone',
  'push.on': 'Enabled on this device ✓ — you will get a notification for every new order or transfer receipt.',
  'push.needsInstall':
    'On iPhone: tap the Share button in Safari → "Add to Home Screen", open the dashboard from the new icon, then enable notifications from here.',
  'push.denied': 'Notifications are blocked in your browser settings. Open the site settings in your browser, allow notifications, then come back here.',
  'push.unsupported':
    "This browser doesn't support notifications. Try Chrome on Android, or Safari on iPhone (after adding the dashboard to the Home Screen).",
  'push.noVapid': 'Notifications need VAPID keys on the server — see the README.',
  'push.off': 'Turn them on to get a notification, like a WhatsApp message, whenever a customer orders from the site.',
  'push.enable': 'Enable notifications',
  'push.enabling': 'Enabling…',
  'push.test': 'Send a test notification',
  'push.disable': 'Turn off on this device',
  'push.noDevices': 'No device was notified — try turning it off and on again',
  'set.payCard': 'Payment & delivery',
  'set.instapay': 'InstaPay address',
  'set.instapayHint': 'What the customer should transfer to (e.g. name@instapay or a number). Leave empty to disable InstaPay.',
  'set.wallet': 'Wallet number',
  'set.walletHint': 'Leave empty to disable wallet payments.',
  'set.walletName': 'Wallet type',
  'set.walletNameHint': 'Shown to the customer, e.g. Vodafone Cash.',
  'set.fee': 'Default delivery fee (EGP)',
  'set.feeHint': 'Added automatically to every new order. You can change it per order.',
  'set.note': 'Delivery note',
  'set.noteHint': 'Shown to the customer on the payment page (in English).',
  'set.account': 'Account',
  'set.accountBody':
    "You sign in from the shop's normal login page with your email and password. To change them, update `ADMIN_EMAIL` or `ADMIN_PASSWORD` in the project settings (Variables on Railway, or Secrets on Cloudflare). Every signed-in device is signed out automatically. If you suspect someone else got in, use \"Sign out of all devices\". A session ends after 1 day of inactivity or after 7 days.",
  'set.signOutAll': 'Sign out of all devices',
  'set.app': 'Use it as an app',
  'set.appBody': 'On your phone open **/admin** and choose "Add to Home Screen" — it opens like an app, without the browser bar.',
  'set.language': 'Language',
  'set.languageHint': 'Choose the language of the dashboard. Your choice is remembered on this device.',
};

export type Key = keyof typeof en;
type Plain = Exclude<Key, `${string}_one`>;

const ar: Record<Plain, string> & Partial<Record<Key, string>> = {
  'nav.home': 'الرئيسية',
  'nav.orders': 'الطلبات',
  'nav.products': 'المنتجات',
  'nav.customers': 'العملاء',
  'nav.settings': 'الإعدادات',
  'app.dashboard': 'لوحة التحكم',
  'app.menu': 'القائمة',
  'app.viewShop': 'عرض المتجر',
  'app.shopShort': 'المتجر ↗',
  'app.signOut': 'تسجيل الخروج',
  'lang.switch': 'تغيير اللغة',

  'common.egp': 'ج.م',
  'common.search': 'بحث',
  'common.retry': 'إعادة المحاولة',
  'common.all': 'الكل',
  'common.save': 'حفظ',
  'common.saving': 'جارٍ الحفظ…',
  'common.saved': 'تم الحفظ ✓',
  'common.cancel': 'إلغاء',
  'common.close': 'إغلاق',
  'common.error': 'حدث خطأ',
  'common.price': 'السعر',
  'time.now': 'الآن',

  'api.network': 'تعذّر الاتصال بالسيرفر — تأكد من الإنترنت',
  'api.generic': 'حدث خطأ، حاول مرة أخرى',
  'srv.invalidUpdates': 'تحديثات غير صالحة',
  'srv.unknownProduct': 'منتج غير معروف: ',
  'srv.pushOff': 'الإشعارات غير مفعّلة على السيرفر (VAPID keys)',
  'srv.badSubscription': 'اشتراك غير صالح',
  'srv.orderNotFound': 'الطلب غير موجود',
  'srv.badStatus': 'حالة غير صحيحة',
  'srv.badPaymentStatus': 'حالة دفع غير صحيحة',
  'srv.itemNotFound': 'صنف غير موجود في الطلب',
  'srv.noImage': 'لا توجد صورة',

  'status.new': 'جديد',
  'status.confirmed': 'مؤكد',
  'status.in_progress': 'قيد التنفيذ',
  'status.shipped': 'تم الشحن',
  'status.delivered': 'تم التسليم',
  'status.cancelled': 'ملغي',
  'pay.unpaid': 'لم يُدفع',
  'pay.pending_review': 'إيصال للمراجعة',
  'pay.paid': 'مدفوع',
  'pay.refunded': 'مسترد',
  'method.cod': 'كاش عند الاستلام',
  'method.instapay': 'إنستاباي',
  'method.wallet': 'محفظة',

  'dash.title': 'أهلاً 👋',
  'dash.sub': 'ملخص المبيعات والطلبات',
  'dash.period': 'الفترة',
  'dash.range7': '٧ أيام',
  'dash.range30': '٣٠ يوم',
  'dash.range90': '٩٠ يوم',
  'dash.new': 'جديد',
  'dash.act.new': 'طلبات جديدة تحتاج تأكيد',
  'dash.act.proofs': 'إيصالات تحويل للمراجعة',
  'dash.act.noTotal': 'طلبات بدون إجمالي',
  'dash.kpi.orders': 'الطلبات',
  'dash.kpi.vsPrev': 'عن الفترة السابقة',
  'dash.kpi.revenue': 'المبيعات',
  'dash.kpi.paid': 'مدفوع: {amount}',
  'dash.kpi.avg': 'متوسط الطلب',
  'dash.kpi.avgHint': 'للطلبات المسعّرة',
  'dash.kpi.customers': 'العملاء',
  'dash.kpi.returning': '{n} عميل رجع تاني',
  'dash.chart.orders': 'عدد الطلبات يومياً',
  'dash.chart.revenue': 'المبيعات يومياً',
  'dash.metric': 'المقياس',
  'dash.metric.orders': 'الطلبات',
  'dash.metric.revenue': 'المبيعات',
  'dash.top': 'الأكثر طلباً',
  'dash.allProducts': 'كل المنتجات ←',
  'dash.noOrders': 'لسه مفيش طلبات في الفترة دي',
  'dash.pieces': '{n} قطعة',
  'dash.cities': 'أكتر المحافظات طلباً',
  'dash.ordersN': '{n} طلب',
  'dash.statuses': 'حالات الطلبات',
  'dash.methods': 'طرق الدفع',
  'dash.pricing': 'تسعير المنتجات',
  'dash.pricingHint': 'المنتجات اللي ليها سعر بيظهر سعرها للعملاء ويتحسب تلقائياً في الطلب.',
  'dash.setPrices': 'حدد الأسعار',

  'orders.title': 'الطلبات',
  'orders.count': '{n} طلب',
  'orders.search': 'رقم الطلب، الاسم، التليفون، المدينة',
  'orders.reviewReceipts': 'إيصالات للمراجعة',
  'orders.noMatch': 'مفيش طلبات بالفلتر ده',
  'orders.none': 'لسه مفيش طلبات',
  'orders.noneHint': 'أول ما عميل يطلب من الموقع هيظهر هنا وهيوصلك إشعار.',
  'orders.clear': 'مسح الفلاتر',
  'orders.items': '{n} قطعة',
  'orders.col.order': 'الطلب',
  'orders.col.customer': 'العميل',
  'orders.col.city': 'المدينة',
  'orders.col.items': 'القطع',
  'orders.col.payment': 'الدفع',
  'orders.col.status': 'الحالة',
  'orders.col.total': 'الإجمالي',
  'orders.col.time': 'الوقت',
  'orders.pages': 'الصفحات',
  'orders.prev': 'السابق',
  'orders.next': 'التالي',

  'od.back': 'الطلبات',
  'od.next.confirmed': 'تأكيد الطلب',
  'od.next.in_progress': 'بدء التنفيذ',
  'od.next.shipped': 'تم الشحن',
  'od.next.delivered': 'تم التسليم',
  'od.print': 'طباعة',
  'od.items': 'المنتجات ({n} قطعة)',
  'od.personalisation': 'الاسم: “{v}”',
  'od.unitPriceFor': 'سعر القطعة لـ {name}',
  'od.subtotal': 'المجموع',
  'od.delivery': 'التوصيل',
  'od.total': 'الإجمالي',
  'od.savePrices': 'حفظ الأسعار',
  'od.payment': 'الدفع',
  'od.proofAlt': 'صورة التحويل',
  'od.proofZoom': 'اضغط على الصورة لتكبيرها',
  'od.confirmPayment': 'تأكيد استلام الدفع',
  'od.rejectProof': 'رفض الإيصال',
  'od.change': 'تغيير:',
  'od.history': 'سجل الطلب',
  'od.customer': 'العميل',
  'od.repeat': 'عميل متكرر · {n} طلبات',
  'od.call': 'اتصال',
  'od.address': 'العنوان',
  'od.customerNotes': 'ملاحظات العميل',
  'od.copyShipping': 'نسخ بيانات الشحن',
  'od.messages': 'رسائل جاهزة للعميل',
  'od.messagesHint': 'بتفتح واتساب برسالة مكتوبة فيها تفاصيل الطلب ولينك المتابعة.',
  'od.msg.confirm': 'تأكيد الطلب والإجمالي',
  'od.msg.making': 'الطلب قيد التنفيذ',
  'od.msg.shipped': 'تم الشحن',
  'od.msg.thanks': 'شكر بعد التسليم',
  'od.copyLink': 'نسخ لينك متابعة الطلب',
  'od.internalNotes': 'ملاحظات داخلية',
  'od.notesPlaceholder': 'مثلاً: العميل عايز اللون أغمق شوية',
  'od.saveNote': 'حفظ الملاحظة',
  'od.status': 'الحالة',
  'od.confirmCancel': 'إلغاء الطلب؟',
  'event.created': 'تم استلام الطلب من الموقع',
  'event.proof': 'العميل رفع صورة التحويل',
  'event.status': 'الحالة: {from} ← {to}',
  'event.payment': 'الدفع: {from} ← {to}',
  'event.total': 'الإجمالي: {n} ج.م',
  'event.pricesUpdated': 'تم تحديث الأسعار',

  'cust.title': 'العملاء',
  'cust.count': '{n} عميل',
  'cust.search': 'الاسم، التليفون، المدينة',
  'cust.noMatch': 'مفيش عملاء بالبحث ده',
  'cust.none': 'لسه مفيش عملاء',
  'cust.noneHint': 'العملاء بيظهروا هنا تلقائياً من الطلبات.',
  'cust.repeat': 'متكرر',
  'cust.orders': 'طلبات',
  'cust.spent': 'إجمالي',
  'cust.last': 'آخر طلب',
  'cust.whatsapp': 'واتساب',
  'cust.call': 'اتصال بـ {name}',
  'cust.ordersLink': 'الطلبات',

  'prod.title': 'المنتجات',
  'prod.sub': '{priced} من {total} منتج ليهم سعر · التغييرات بتظهر في الموقع خلال دقيقة',
  'prod.name': 'اسم المنتج',
  'prod.category': 'القسم',
  'prod.allCategories': 'كل الأقسام',
  'prod.filter.unpriced': 'بدون سعر',
  'prod.filter.soldout': 'خلصان',
  'prod.filter.hidden': 'مخفي',
  'prod.empty': 'مفيش منتجات بالفلتر ده',
  'prod.colors': '{n} ألوان',
  'prod.sold': 'اتباع {n}',
  'prod.priceOf': 'سعر {name}',
  'prod.soldOutOf': '{name} خلصان',
  'prod.hide': 'إخفاء {name}',
  'prod.unsaved': '{n} تغيير مش محفوظ',
  'prod.savedMsg': 'تم الحفظ ✓ — الموقع هيتحدث خلال دقيقة',
  'prod.undo': 'تراجع',
  'prod.ok': 'تمام',

  'set.title': 'الإعدادات',
  'push.title': 'إشعارات الطلبات على الموبايل',
  'push.on': 'مفعّلة على الجهاز ده ✓ — هيوصلك إشعار مع كل طلب جديد أو إيصال تحويل.',
  'push.needsInstall':
    'على الآيفون: اضغط زر المشاركة في Safari ← "إضافة إلى الشاشة الرئيسية"، وافتح لوحة التحكم من الأيقونة الجديدة، وبعدها فعّل الإشعارات من هنا.',
  'push.denied': 'الإشعارات مقفولة من إعدادات المتصفح. افتح إعدادات الموقع في المتصفح واسمح بالإشعارات، وبعدين ارجع هنا.',
  'push.unsupported': 'المتصفح ده مش بيدعم الإشعارات. جرّب Chrome على أندرويد أو Safari على آيفون (بعد إضافة اللوحة للشاشة الرئيسية).',
  'push.noVapid': 'الإشعارات محتاجة مفاتيح VAPID على السيرفر — شوف README.',
  'push.off': 'فعّلها عشان يوصلك إشعار زي رسايل الواتساب كل ما عميل يطلب من الموقع.',
  'push.enable': 'تفعيل الإشعارات',
  'push.enabling': 'جارٍ التفعيل…',
  'push.test': 'إرسال إشعار تجريبي',
  'push.disable': 'إيقاف على الجهاز ده',
  'push.noDevices': 'مفيش أجهزة اتبعتلها — جرّب تقفل وتفعّل تاني',
  'set.payCard': 'الدفع والتوصيل',
  'set.instapay': 'عنوان إنستاباي',
  'set.instapayHint': 'اللي العميل هيحوّل عليه (مثلاً name@instapay أو رقم). سيبه فاضي لو مش عايز إنستاباي.',
  'set.wallet': 'رقم المحفظة',
  'set.walletHint': 'سيبه فاضي لو مش عايز دفع بالمحفظة.',
  'set.walletName': 'نوع المحفظة',
  'set.walletNameHint': 'بيظهر للعميل، مثلاً Vodafone Cash.',
  'set.fee': 'مصاريف التوصيل الافتراضية (ج.م)',
  'set.feeHint': 'بتتحط تلقائياً على كل طلب جديد، وتقدر تغيّرها لكل طلب.',
  'set.note': 'ملاحظة التوصيل',
  'set.noteHint': 'بتظهر للعميل في صفحة الدفع (بالإنجليزي).',
  'set.account': 'الحساب',
  'set.accountBody':
    'بتدخل من صفحة تسجيل الدخول العادية في الموقع بالإيميل وكلمة المرور. لتغييرهم: غيّر `ADMIN_EMAIL` أو `ADMIN_PASSWORD` من إعدادات المشروع (Variables على Railway، أو Secrets على Cloudflare). أي جهاز مسجّل دخول هيخرج تلقائياً. لو حاسس إن حد تاني دخل، استخدم "تسجيل الخروج من كل الأجهزة". الجلسة بتنتهي بعد يوم من عدم الاستخدام أو بعد 7 أيام.',
  'set.signOutAll': 'تسجيل الخروج من كل الأجهزة',
  'set.app': 'استخدمها كتطبيق',
  'set.appBody': 'على الموبايل افتح **/admin** واختار "إضافة إلى الشاشة الرئيسية" — هتفتح زي التطبيق ومن غير شريط المتصفح.',
  'set.language': 'اللغة',
  'set.languageHint': 'اختار لغة لوحة التحكم. اختيارك بيتحفظ على الجهاز ده.',
};

const DICT: Record<Lang, Partial<Record<Key, string>>> = { en, ar };

/** Every dictionary key (used by the tests to prove both languages are complete). */
export const ALL_KEYS = Object.keys(en) as Key[];

/** Translate `key` into the current language, filling `{placeholders}` from `vars`. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const dict = DICT[current];
  const one = vars?.n === 1 ? (`${key}_one` as Key) : null;
  const template = (one && dict[one]) || dict[key] || en[key] || key;
  return vars ? template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : template;
}

/** Messages the API returns in Arabic → their dictionary key, so English mode can show them in English. */
const SERVER_MESSAGES: [Key, boolean][] = [
  ['srv.invalidUpdates', false],
  ['srv.unknownProduct', true], // prefix match: "<message><product id>"
  ['srv.pushOff', false],
  ['srv.badSubscription', false],
  ['srv.orderNotFound', false],
  ['srv.badStatus', false],
  ['srv.badPaymentStatus', false],
  ['srv.itemNotFound', false],
  ['srv.noImage', false],
];

export function localizeServerMessage(message: string): string {
  if (current === 'ar') return message;
  for (const [key, prefix] of SERVER_MESSAGES) {
    const arabic = ar[key as Plain];
    if (prefix ? message.startsWith(arabic) : message === arabic) return prefix ? en[key] + message.slice(arabic.length) : en[key];
  }
  return message;
}

/**
 * Order-history entries are stored by the server in Arabic. In English mode we rebuild the sentence
 * from its type and parameters; anything we don't recognise is shown exactly as stored.
 */
export function eventText(e: { type: string; message: string }): string {
  if (current === 'ar') return e.message;
  const label = (prefix: 'status' | 'pay', raw: string) => {
    const hit = (Object.keys(ar) as Key[]).find((k) => k.startsWith(`${prefix}.`) && ar[k] === raw);
    // The server wrote "إيصال بانتظار المراجعة" for pending_review; the dashboard badge says "إيصال للمراجعة".
    if (!hit && prefix === 'pay' && raw === 'إيصال بانتظار المراجعة') return en['pay.pending_review'];
    return hit ? en[hit] : raw;
  };
  switch (e.type) {
    case 'created':
      return en['event.created'];
    case 'proof':
      return en['event.proof'];
    case 'status': {
      const m = /^الحالة: (.+) ← (.+)$/.exec(e.message);
      return m ? t('event.status', { from: label('status', m[1]), to: label('status', m[2]) }) : e.message;
    }
    case 'payment': {
      const m = /^الدفع: (.+) ← (.+)$/.exec(e.message);
      return m ? t('event.payment', { from: label('pay', m[1]), to: label('pay', m[2]) }) : e.message;
    }
    case 'pricing': {
      const m = /^الإجمالي: (\d+) ج\.م$/.exec(e.message);
      return m ? t('event.total', { n: m[1] }) : e.message === 'تم تحديث الأسعار' ? en['event.pricesUpdated'] : e.message;
    }
    default:
      return e.message;
  }
}

/** Category name in the dashboard language. */
export const categoryLabel = (c: { name: string; nameAr?: string }): string => (current === 'ar' ? c.nameAr || c.name : c.name);

/**
 * Renders `code` and **bold** markers from a translated string as React nodes
 * (kept out of this .ts file so it stays JSX-free — see rich() in ui.tsx).
 */
export const RICH_SPLIT = /(`[^`]+`|\*\*[^*]+\*\*)/g;

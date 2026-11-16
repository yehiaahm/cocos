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
  'common.unsaved': 'You have unsaved changes',
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
  'od.shipping': 'Shipping & tracking',
  'od.shippingHint': 'Shown to the customer on their order page once the order is on its way.',
  'od.courier': 'Courier',
  'od.courierPlaceholder': 'e.g. Bosta, Aramex, own delivery',
  'od.trackingNumber': 'Tracking number',
  'od.saveShipping': 'Save shipping details',
  'od.tellCustomer': 'Order is now "{status}" — tell the customer on WhatsApp?',
  'od.tellCustomerBtn': 'Send WhatsApp message',
  'od.dismiss': 'Not now',
  'event.created': 'Order received from the website',
  'event.proof': 'Customer uploaded the transfer screenshot',
  'event.status': 'Status: {from} → {to}',
  'event.payment': 'Payment: {from} → {to}',
  'event.total': 'Total: {n} EGP',
  'event.pricesUpdated': 'Prices updated',
  'event.tracking': 'Shipping: {v}',
  'event.trackingCleared': 'Shipping details removed',

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
  'prod.stock': 'Stock',
  'prod.stockOf': 'Units in stock of {name}',
  'prod.hide': 'Hide {name}',
  'prod.unsaved': '{n} unsaved changes',
  'prod.unsaved_one': '1 unsaved change',
  'prod.savedMsg': 'Saved ✓ — the site will update within a minute',
  'prod.undo': 'Undo',
  'prod.ok': 'OK',

  // Catalogue management (products + categories)
  'cat.tab.products': 'Products',
  'cat.tab.categories': 'Categories',
  'prod.add': 'Add product',
  'prod.edit': 'Edit',
  'pe.titleNew': 'New product',
  'pe.titleEdit': 'Edit product',
  'pe.back': 'Products',
  'pe.basics': 'Details',
  'pe.name': 'Product name',
  'pe.nameHint': 'Shown to customers, in English.',
  'pe.description': 'Description',
  'pe.descriptionHint': 'One or two sentences. Used on the product page and in search results.',
  'pe.category': 'Category',
  'pe.chooseCategory': 'Choose a category',
  'pe.occasions': 'Occasions',
  'pe.occasionsHint': 'Tick every occasion this product suits. "Personalised" lets customers type a name when they order.',
  'pe.slug': 'Web address',
  'pe.slugHint': 'Leave empty to create it from the name. Lowercase letters, numbers and dashes only.',
  'pe.slugPreview': 'Page:',
  'pe.availability': 'Price & availability',
  'pe.price': 'Price (EGP)',
  'pe.priceHint': 'Leave empty to show "Price pending" and confirm the price with each customer.',
  'pe.stock': 'Units in stock',
  'pe.stockHint': 'Leave empty to not track stock. With a number, each order subtracts from it and the product shows as sold out at 0.',
  'pe.soldOut': 'Sold out',
  'pe.hidden': 'Hidden from the shop',
  'pe.variants': 'Colours / options',
  'pe.variantsHint': 'Most products have one. Add more when the same piece comes in other colours — customers pick one on the product page.',
  'pe.variantNumber': 'Option {n}',
  'pe.variantName': 'Option name',
  'pe.variantNamePlaceholder': 'e.g. Emerald',
  'pe.material': 'Material',
  'pe.materialPlaceholder': 'e.g. Resin',
  'pe.photos': 'Photos',
  'pe.photosHint': 'The first photo is shown first. Big phone photos are shrunk automatically before uploading.',
  'pe.addPhotos': 'Add photos',
  'pe.uploading': 'Uploading…',
  'pe.cover': 'Cover',
  'pe.makeCover': 'Use as the cover photo',
  'pe.removePhoto': 'Remove photo',
  'pe.makeFirst': 'Move to first place',
  'pe.addVariant': 'Add another option',
  'pe.removeVariant': 'Remove this option',
  'pe.removeVariantConfirm': 'Remove this option and its photos from the product?',
  'pe.save': 'Save changes',
  'pe.create': 'Add product',
  'pe.delete': 'Delete product',
  'pe.deleteConfirm': 'Delete "{name}" from the shop? Past orders keep their details. This cannot be undone.',
  'pe.saved': 'Saved ✓ — the shop updates within a minute',
  'pe.created': 'Product added ✓ — it shows first in the shop within a minute',
  'pe.viewOnShop': 'View on the shop ↗',
  'pe.loadError': 'This product could not be loaded.',
  'pe.photoRead': 'This file could not be read as a photo.',
  'pe.uploadFailed': 'The photo could not be uploaded.',
  'pe.uploadingWait': 'Wait for the photos to finish uploading.',
  'pe.leave': 'You have unsaved changes. Leave without saving?',
  'cats.title': 'Categories',
  'cats.sub': '{n} categories · they appear in the shop, the footer and the homepage',
  'cats.sub_one': '1 category · it appears in the shop, the footer and the homepage',
  'cats.add': 'Add category',
  'cats.addTitle': 'New category',
  'cats.name': 'Name (English)',
  'cats.nameAr': 'Name (Arabic)',
  'cats.nameArHint': 'Used by the Arabic dashboard and as the accent label on the homepage. Falls back to the English name.',
  'cats.description': 'Description',
  'cats.descriptionHint': 'Shown under the heading on the category page.',
  'cats.slug': 'Web address (optional)',
  'cats.slugHint': 'Created from the name if left empty. It cannot be changed later because it is part of the page address.',
  'cats.products': '{n} products',
  'cats.products_one': '1 product',
  'cats.edit': 'Edit',
  'cats.delete': 'Delete',
  'cats.moveUp': 'Move up',
  'cats.moveDown': 'Move down',
  'cats.deleteEmpty': 'Delete the category "{name}"?',
  'cats.hasProducts': '"{name}" still has {n} products. Choose a category to move them to — then it is deleted.',
  'cats.hasProducts_one': '"{name}" still has 1 product. Choose a category to move it to — then it is deleted.',
  'cats.moveTo': 'Move the products to',
  'cats.noOther': 'There is no other category to move the products to. Add one first.',
  'cats.moveAndDelete': 'Move and delete',
  'cats.created': 'Category added ✓',
  'cats.saved': 'Saved ✓',
  'cats.deleted': 'Category deleted ✓',
  'cats.empty': 'No categories yet',
  'cats.viewOnShop': 'View on the shop ↗',
  'err.name_required': 'Please enter a name (at least 2 characters).',
  'err.category_missing': 'Choose a category.',
  'err.slug_taken': 'This web address is already used. Pick another one.',
  'err.slug_invalid': 'The web address may only contain lowercase letters, numbers and dashes.',
  'err.bad_tag': 'Unknown occasion.',
  'err.variant_required': 'Add at least one colour / option.',
  'err.too_many_variants': 'Too many colours / options (30 at most).',
  'err.variant_name': 'Every colour / option needs a name.',
  'err.too_many_images': 'Too many photos in one option (12 at most).',
  'err.invalid_image': 'One of the photos is not valid. Remove it and upload it again.',
  'err.image_required': 'Add at least one photo.',
  'err.has_products': 'This category still has products. Move them first.',
  'err.bad_order': 'The order is not valid. Reload the page and try again.',
  'err.not_found': 'It was not found — it may have been deleted. Reload the page.',
  'err.too_large': 'The photo is too large.',
  'err.bad_type': 'Please use a JPG, PNG or WebP photo.',
  'err.no_file': 'Choose a photo to upload.',
  'err.catalog_full': 'The limit has been reached.',

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
  'push.noDevices': 'No device is registered on the server — turn notifications off and on again on this device',
  'push.rejected': "The phone's push service rejected the notification (code {codes}). Turn notifications off, then on again on this device.",
  'push.timeout': "This browser couldn't reach its push service. Check the connection (or that Google services are available) and try again.",
  'set.payCard': 'Payment & delivery',
  'set.instapay': 'InstaPay address',
  'set.instapayHint': 'What the customer should transfer to (e.g. name@instapay or a number). Leave empty to disable InstaPay.',
  'set.instapayLink': 'InstaPay payment link',
  'set.instapayLinkHint': 'Optional. In the InstaPay app, share your payment link and paste it here (https://ipn.eg/…). On phones the customer is taken straight to the send-money screen.',
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
  'common.unsaved': 'عندك تعديلات مش محفوظة',
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
  'od.shipping': 'الشحن والتتبع',
  'od.shippingHint': 'بتظهر للعميل في صفحة طلبه أول ما الطلب يتشحن.',
  'od.courier': 'شركة الشحن',
  'od.courierPlaceholder': 'مثلاً: بوسطة، أرامكس، توصيل خاص',
  'od.trackingNumber': 'رقم الشحنة',
  'od.saveShipping': 'حفظ بيانات الشحن',
  'od.tellCustomer': 'الطلب بقى "{status}" — تبعت للعميل رسالة على واتساب؟',
  'od.tellCustomerBtn': 'ابعت رسالة واتساب',
  'od.dismiss': 'مش دلوقتي',
  'event.created': 'تم استلام الطلب من الموقع',
  'event.proof': 'العميل رفع صورة التحويل',
  'event.status': 'الحالة: {from} ← {to}',
  'event.payment': 'الدفع: {from} ← {to}',
  'event.total': 'الإجمالي: {n} ج.م',
  'event.pricesUpdated': 'تم تحديث الأسعار',
  'event.tracking': 'الشحن: {v}',
  'event.trackingCleared': 'تم حذف بيانات الشحن',

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
  'prod.stock': 'الكمية',
  'prod.stockOf': 'الكمية المتاحة من {name}',
  'prod.hide': 'إخفاء {name}',
  'prod.unsaved': '{n} تغيير مش محفوظ',
  'prod.savedMsg': 'تم الحفظ ✓ — الموقع هيتحدث خلال دقيقة',
  'prod.undo': 'تراجع',
  'prod.ok': 'تمام',

  'cat.tab.products': 'المنتجات',
  'cat.tab.categories': 'الأقسام',
  'prod.add': 'إضافة منتج',
  'prod.edit': 'تعديل',
  'pe.titleNew': 'منتج جديد',
  'pe.titleEdit': 'تعديل المنتج',
  'pe.back': 'المنتجات',
  'pe.basics': 'البيانات',
  'pe.name': 'اسم المنتج',
  'pe.nameHint': 'بيظهر للعملاء، بالإنجليزي.',
  'pe.description': 'الوصف',
  'pe.descriptionHint': 'جملة أو اتنين. بتظهر في صفحة المنتج وفي نتايج البحث.',
  'pe.category': 'القسم',
  'pe.chooseCategory': 'اختار القسم',
  'pe.occasions': 'المناسبات',
  'pe.occasionsHint': 'علّم كل مناسبة بيناسبها المنتج. "Personalised" بيخلّي العميل يكتب اسم وهو بيطلب.',
  'pe.slug': 'عنوان الصفحة',
  'pe.slugHint': 'سيبه فاضي وهيتعمل من الاسم. حروف إنجليزي صغيرة وأرقام وشرطات بس.',
  'pe.slugPreview': 'الصفحة:',
  'pe.availability': 'السعر والتوفر',
  'pe.price': 'السعر (ج.م)',
  'pe.priceHint': 'سيبه فاضي عشان يظهر "Price pending" وتأكد السعر مع كل عميل.',
  'pe.stock': 'الكمية المتاحة',
  'pe.stockHint': 'سيبها فاضية لو مش عاوز تتابع الكمية. لو كتبت رقم، كل طلب بيخصم منه والمنتج بيظهر "خلصان" لما يوصل صفر.',
  'pe.soldOut': 'خلصان',
  'pe.hidden': 'مخفي من المتجر',
  'pe.variants': 'الألوان / الاختيارات',
  'pe.variantsHint': 'أغلب المنتجات ليها اختيار واحد. زوّد لما نفس القطعة تيجي بألوان تانية — العميل بيختار واحد من صفحة المنتج.',
  'pe.variantNumber': 'اختيار {n}',
  'pe.variantName': 'اسم الاختيار',
  'pe.variantNamePlaceholder': 'مثلاً: Emerald',
  'pe.material': 'الخامة',
  'pe.materialPlaceholder': 'مثلاً: Resin',
  'pe.photos': 'الصور',
  'pe.photosHint': 'أول صورة بتظهر الأول. صور الموبايل الكبيرة بتتصغّر لوحدها قبل الرفع.',
  'pe.addPhotos': 'إضافة صور',
  'pe.uploading': 'جارٍ الرفع…',
  'pe.cover': 'الغلاف',
  'pe.makeCover': 'استخدمها كصورة الغلاف',
  'pe.removePhoto': 'حذف الصورة',
  'pe.makeFirst': 'خليها الأولى',
  'pe.addVariant': 'إضافة اختيار تاني',
  'pe.removeVariant': 'حذف الاختيار ده',
  'pe.removeVariantConfirm': 'تحذف الاختيار ده وصوره من المنتج؟',
  'pe.save': 'حفظ التعديلات',
  'pe.create': 'إضافة المنتج',
  'pe.delete': 'حذف المنتج',
  'pe.deleteConfirm': 'تحذف "{name}" من المتجر؟ الطلبات القديمة بتفضل محتفظة بتفاصيلها. مينفعش ترجّعه.',
  'pe.saved': 'تم الحفظ ✓ — المتجر هيتحدث خلال دقيقة',
  'pe.created': 'تمت إضافة المنتج ✓ — هيظهر الأول في المتجر خلال دقيقة',
  'pe.viewOnShop': 'عرض في المتجر ↗',
  'pe.loadError': 'مقدرناش نحمّل المنتج ده.',
  'pe.photoRead': 'الملف ده مش قادرين نقراه كصورة.',
  'pe.uploadFailed': 'مقدرناش نرفع الصورة.',
  'pe.uploadingWait': 'استنى لحد ما الصور تخلّص رفع.',
  'pe.leave': 'عندك تعديلات مش محفوظة. تخرج من غير حفظ؟',
  'cats.title': 'الأقسام',
  'cats.sub': '{n} قسم · بتظهر في المتجر والفوتر والصفحة الرئيسية',
  'cats.add': 'إضافة قسم',
  'cats.addTitle': 'قسم جديد',
  'cats.name': 'الاسم (إنجليزي)',
  'cats.nameAr': 'الاسم (عربي)',
  'cats.nameArHint': 'بيظهر في لوحة التحكم العربية وكعنوان فرعي في الصفحة الرئيسية. لو سبته فاضي بيستخدم الاسم الإنجليزي.',
  'cats.description': 'الوصف',
  'cats.descriptionHint': 'بيظهر تحت عنوان صفحة القسم.',
  'cats.slug': 'عنوان الصفحة (اختياري)',
  'cats.slugHint': 'بيتعمل من الاسم لو سبته فاضي. مينفعش يتغيّر بعدين لأنه جزء من عنوان الصفحة.',
  'cats.products': '{n} منتج',
  'cats.edit': 'تعديل',
  'cats.delete': 'حذف',
  'cats.moveUp': 'لفوق',
  'cats.moveDown': 'لتحت',
  'cats.deleteEmpty': 'تحذف القسم "{name}"؟',
  'cats.hasProducts': '"{name}" لسه فيه {n} منتج. اختار قسم تنقلهم له — وبعدها القسم بيتحذف.',
  'cats.moveTo': 'انقل المنتجات إلى',
  'cats.noOther': 'مفيش قسم تاني تنقل له المنتجات. ضيف قسم الأول.',
  'cats.moveAndDelete': 'انقل واحذف',
  'cats.created': 'تمت إضافة القسم ✓',
  'cats.saved': 'تم الحفظ ✓',
  'cats.deleted': 'تم حذف القسم ✓',
  'cats.empty': 'لسه مفيش أقسام',
  'cats.viewOnShop': 'عرض في المتجر ↗',
  'err.name_required': 'اكتب اسم (حرفين على الأقل).',
  'err.category_missing': 'اختار القسم.',
  'err.slug_taken': 'عنوان الصفحة ده مستخدم. اختار غيره.',
  'err.slug_invalid': 'عنوان الصفحة يقبل حروف إنجليزي صغيرة وأرقام وشرطات بس.',
  'err.bad_tag': 'مناسبة غير معروفة.',
  'err.variant_required': 'ضيف لون / اختيار واحد على الأقل.',
  'err.too_many_variants': 'ألوان / اختيارات كتير (30 بالكتير).',
  'err.variant_name': 'كل لون / اختيار محتاج اسم.',
  'err.too_many_images': 'صور كتير في اختيار واحد (12 بالكتير).',
  'err.invalid_image': 'واحدة من الصور مش صالحة. احذفها وارفعها تاني.',
  'err.image_required': 'ضيف صورة واحدة على الأقل.',
  'err.has_products': 'القسم ده لسه فيه منتجات. انقلهم الأول.',
  'err.bad_order': 'الترتيب مش صالح. حدّث الصفحة وجرّب تاني.',
  'err.not_found': 'مش موجود — ممكن يكون اتحذف. حدّث الصفحة.',
  'err.too_large': 'الصورة كبيرة قوي.',
  'err.bad_type': 'استخدم صورة JPG أو PNG أو WebP.',
  'err.no_file': 'اختار صورة للرفع.',
  'err.catalog_full': 'وصلت للحد الأقصى.',

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
  'push.noDevices': 'مفيش جهاز مسجّل على السيرفر — اقفل الإشعارات وفعّلها تاني على الجهاز ده',
  'push.rejected': 'خدمة الإشعارات بتاعة الموبايل رفضت الإشعار (كود {codes}). اقفل الإشعارات وفعّلها تاني على الجهاز ده.',
  'push.timeout': 'المتصفح مقدرش يوصل لخدمة الإشعارات بتاعته. اتأكد من النت (أو إن خدمات Google شغالة) وجرّب تاني.',
  'set.payCard': 'الدفع والتوصيل',
  'set.instapay': 'عنوان إنستاباي',
  'set.instapayHint': 'اللي العميل هيحوّل عليه (مثلاً name@instapay أو رقم). سيبه فاضي لو مش عايز إنستاباي.',
  'set.instapayLink': 'رابط الدفع في إنستاباي',
  'set.instapayLinkHint': 'اختياري. من تطبيق إنستاباي شارك رابط الدفع بتاعك والصقه هنا (https://ipn.eg/…). على الموبايل العميل بيروح على شاشة التحويل على طول.',
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
    case 'tracking': {
      const m = /^الشحن: (.+)$/.exec(e.message);
      return m ? t('event.tracking', { v: m[1] }) : e.message === 'تم حذف بيانات الشحن' ? en['event.trackingCleared'] : e.message;
    }
    case 'pricing': {
      const m = /^الإجمالي: (\d+) ج\.م$/.exec(e.message);
      return m ? t('event.total', { n: m[1] }) : e.message === 'تم تحديث الأسعار' ? en['event.pricesUpdated'] : e.message;
    }
    default:
      return e.message;
  }
}

/**
 * Text for an error from the API: known error codes are shown in the dashboard language,
 * anything else keeps the server's own message.
 */
export function errorText(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  const key = `err.${code}` as Key;
  if (code && key in en) return t(key);
  return e instanceof Error && e.message ? e.message : t('common.error');
}


/** Category name in the dashboard language. */
export const categoryLabel = (c: { name: string; nameAr?: string }): string => (current === 'ar' ? c.nameAr || c.name : c.name);

/**
 * Renders `code` and **bold** markers from a translated string as React nodes
 * (kept out of this .ts file so it stays JSX-free — see rich() in ui.tsx).
 */
export const RICH_SPLIT = /(`[^`]+`|\*\*[^*]+\*\*)/g;

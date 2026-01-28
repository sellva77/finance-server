const Settings = require('../models/Settings');

// Currency data with symbols and locales
const currencyData = {
    INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
    USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
    EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
    GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
    JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
    AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
    CHF: { symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
    CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
    SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
    AED: { symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
    SAR: { symbol: '﷼', name: 'Saudi Riyal', locale: 'ar-SA' },
    BRL: { symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
    MXN: { symbol: '$', name: 'Mexican Peso', locale: 'es-MX' },
    ZAR: { symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
    NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
    KRW: { symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
    THB: { symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
    MYR: { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
    PHP: { symbol: '₱', name: 'Philippine Peso', locale: 'en-PH' },
    IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID' },
    VND: { symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN' },
    TWD: { symbol: 'NT$', name: 'Taiwan Dollar', locale: 'zh-TW' },
    HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK' },
    RUB: { symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU' },
    TRY: { symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR' },
    PLN: { symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL' },
    SEK: { symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
    NOK: { symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO' },
    DKK: { symbol: 'kr', name: 'Danish Krone', locale: 'da-DK' },
    CZK: { symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ' },
    HUF: { symbol: 'Ft', name: 'Hungarian Forint', locale: 'hu-HU' },
    ILS: { symbol: '₪', name: 'Israeli Shekel', locale: 'he-IL' },
    CLP: { symbol: '$', name: 'Chilean Peso', locale: 'es-CL' },
    COP: { symbol: '$', name: 'Colombian Peso', locale: 'es-CO' },
    PEN: { symbol: 'S/', name: 'Peruvian Sol', locale: 'es-PE' },
    ARS: { symbol: '$', name: 'Argentine Peso', locale: 'es-AR' },
    EGP: { symbol: 'E£', name: 'Egyptian Pound', locale: 'ar-EG' },
    PKR: { symbol: '₨', name: 'Pakistani Rupee', locale: 'ur-PK' },
    BDT: { symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD' },
    LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee', locale: 'si-LK' },
    NGN: { symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG' },
    KES: { symbol: 'KSh', name: 'Kenyan Shilling', locale: 'sw-KE' },
    GHS: { symbol: '₵', name: 'Ghanaian Cedi', locale: 'en-GH' },
    TZS: { symbol: 'TSh', name: 'Tanzanian Shilling', locale: 'sw-TZ' },
    UGX: { symbol: 'USh', name: 'Ugandan Shilling', locale: 'en-UG' },
    MAD: { symbol: 'د.م.', name: 'Moroccan Dirham', locale: 'ar-MA' },
    QAR: { symbol: '﷼', name: 'Qatari Riyal', locale: 'ar-QA' },
    KWD: { symbol: 'د.ك', name: 'Kuwaiti Dinar', locale: 'ar-KW' },
    BHD: { symbol: '.د.ب', name: 'Bahraini Dinar', locale: 'ar-BH' },
    OMR: { symbol: '﷼', name: 'Omani Rial', locale: 'ar-OM' },
    JOD: { symbol: 'د.ا', name: 'Jordanian Dinar', locale: 'ar-JO' }
};

// @desc    Get user settings
// @route   GET /api/settings
// @access  Private
exports.getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne({ user: req.user.id });

        // If no settings exist, create default settings
        if (!settings) {
            settings = await Settings.create({
                user: req.user.id,
                currency: {
                    code: 'INR',
                    symbol: '₹',
                    name: 'Indian Rupee',
                    locale: 'en-IN'
                }
            });
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update user settings
// @route   PUT /api/settings
// @access  Private
exports.updateSettings = async (req, res, next) => {
    try {
        const { 
            currency, 
            dateFormat, 
            theme, 
            notifications, 
            conversionRates,
            defaultAccount,
            fiscalYearStart,
            numberFormat,
            dashboardLayout
        } = req.body;

        let updateData = {};

        // If currency code is provided, populate full currency data
        if (currency && currency.code) {
            const currencyInfo = currencyData[currency.code];
            if (currencyInfo) {
                updateData.currency = {
                    code: currency.code,
                    symbol: currencyInfo.symbol,
                    name: currencyInfo.name,
                    locale: currencyInfo.locale
                };
            }
        }

        if (dateFormat) updateData.dateFormat = dateFormat;
        if (theme) updateData.theme = theme;
        if (notifications) updateData.notifications = notifications;
        if (conversionRates) updateData.conversionRates = conversionRates;
        if (defaultAccount !== undefined) updateData.defaultAccount = defaultAccount;
        if (fiscalYearStart) updateData.fiscalYearStart = fiscalYearStart;
        if (numberFormat) updateData.numberFormat = numberFormat;
        if (dashboardLayout) updateData.dashboardLayout = dashboardLayout;

        let settings = await Settings.findOneAndUpdate(
            { user: req.user.id },
            updateData,
            { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get available currencies
// @route   GET /api/settings/currencies
// @access  Private
exports.getCurrencies = async (req, res, next) => {
    try {
        const currencies = Object.entries(currencyData).map(([code, data]) => ({
            code,
            ...data
        }));

        res.status(200).json({
            success: true,
            count: currencies.length,
            data: currencies
        });
    } catch (err) {
        next(err);
    }
};

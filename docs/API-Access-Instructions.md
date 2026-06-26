% Connecting Your Ad Accounts to the Reporting Dashboard
% Avis Budget Group
% What we need, and how to get it

# What this is for

The Avis Budget Group reporting dashboard brings your **Meta, Reddit and TikTok**
advertising into one place — daily spend, ROAS, current budgets, and recommended
budget changes you can review and approve.

To connect it to your accounts, a few details are needed from each platform. This
document explains exactly what to get and where to find it.

**A note on security:** these details only allow the dashboard to *read* your
performance data and *update campaign budgets* — nothing else. They can never be
used to access billing, change creative, or post anything. Access can be revoked
at any time, and the details should always be shared securely (see the last page).

> The Business IDs and invite email to use in the "Give access" steps below will
> be provided to you separately. Where you see a blank like `[_________]`, fill in
> the value you've been given.

---

# The simplest option (recommended)

For most of these, the easiest path is to **grant access to your ad accounts** and
let the dashboard administrator handle the technical setup. If you'd prefer to
generate everything yourself, the step-by-step instructions for each platform
follow afterwards.

Either way, the quickest single thing to provide is the **account ID** for each
platform — these are safe to share and confirm the right accounts are connected:

| Platform | What to provide | Looks like |
|---|---|---|
| Meta (Facebook / Instagram) | Ad Account ID | `act_1023456789012345` |
| Reddit | Ad Account ID | a short code from your Reddit Ads page |
| TikTok | Advertiser ID | a long number, e.g. `7012345678901234567` |

---

# Meta (Facebook & Instagram) Ads

### 1. Find your Ad Account ID  *(2 minutes)*

1. Go to **[adsmanager.facebook.com](https://adsmanager.facebook.com)** and sign in.
2. Click the account name in the top-left corner.
3. Copy the **Ad Account ID** shown under the account — it's a number that starts
   with `act_` (for example `act_1023456789012345`).

### 2. Grant access  *(easiest — 3 minutes)*

1. Go to **[business.facebook.com/settings](https://business.facebook.com/settings)**.
2. In the left menu, choose **Partners** (under "Users").
3. Click **Add → Give a partner access to your assets**.
4. Enter the **Business ID** you've been given for the dashboard: `[_________]`.
5. Select your **ad account** and turn on **Manage campaigns**.
6. Click **Save**. The secure key is then generated for you — nothing else to do.

### Advanced — generate the key yourself (optional)

If you'd rather not grant partner access, you can create the key directly:

1. In **Business Settings → Users → System Users**, click **Add** and create a
   system user with the **Admin** role.
2. Click **Generate new token**, select your ad account, and tick the
   **`ads_read`** and **`ads_management`** permissions.
3. Copy the long token that appears and provide it along with your Ad Account ID.

📘 Official guide: <https://www.facebook.com/business/help/503306463479099>

---

# Reddit Ads

### 1. Find your Ad Account ID  *(2 minutes)*

1. Go to **[ads.reddit.com](https://ads.reddit.com)** and sign in.
2. Open **Settings** (or look at the web address while in your account — the
   account code appears in the URL).
3. Copy the **Ad Account ID**.

### 2. Grant access  *(easiest — 2 minutes)*

1. In Reddit Ads, open **Settings → Members** (or **Account access**).
2. **Invite a member** using the email you've been given for the dashboard
   (`[_________]`), with the **Admin** or **Advertiser** role.
3. The secure connection is then set up for you.

### Advanced — generate the keys yourself (optional)

Reddit requires a small "app" to be created for API access, which produces two
values — a **Client ID** and a **Client Secret**:

1. Make sure you're logged in to the Reddit account that has access to the ads
   account, then go to **[reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)**.
2. Click **Create another app…**, give it any name, and choose the **script** type.
3. After saving, copy the **Client ID** (the code shown under the app name) and the
   **Secret**. Provide both, plus your Ad Account ID.

📘 Official guide: <https://ads-api.reddit.com/docs/v3/>

---

# TikTok Ads

### 1. Find your Advertiser ID  *(2 minutes)*

1. Go to **[ads.tiktok.com](https://ads.tiktok.com)** and sign in.
2. Click your account name (top-right) → **Account Info**, or look at the web
   address — the **Advertiser ID** is the long number shown there
   (for example `7012345678901234567`).

### 2. Grant access  *(easiest — 3 minutes)*

1. Go to **[business.tiktok.com](https://business.tiktok.com)** → **Business Center**.
2. Open **Members** or **Partners** and send an invite using the Business Center ID
   or email you've been given for the dashboard (`[_________]`), with access to your
   **ad account**.
3. The secure key is then generated for you.

### Advanced — generate the key yourself (optional)

TikTok requires a developer "app" to produce an **App ID**, **App Secret** and an
**Access Token**:

1. Go to the **[TikTok for Business Developers portal](https://business-api.tiktok.com/portal)**
   and log in.
2. Create an app — note the **App ID** and **App Secret**.
3. Authorise the app for your advertiser account to generate an **Access Token**.
4. Provide the App ID, App Secret, Access Token and your Advertiser ID.

📘 Official guide: <https://business-api.tiktok.com/portal/docs>

---

# What to provide — quick checklist

You don't need everything in both columns — **either** grant access **or** provide
the keys. The account IDs are always helpful.

**Meta**

- [ ] Ad Account ID (`act_…`)
- [ ] Either: partner access granted  —  or: Access Token

**Reddit**

- [ ] Ad Account ID
- [ ] Either: member access granted  —  or: Client ID + Client Secret

**TikTok**

- [ ] Advertiser ID
- [ ] Either: Business Center access granted  —  or: App ID + App Secret + Access Token

---

# How to share these safely

Please **don't email** the keys and secrets in plain text. Any one of these is fine:

- Use a one-time secret link via **<https://onetimesecret.com>** (paste the values,
  it creates a link that self-destructs after it's opened).
- Share them in a password manager (e.g. 1Password / Bitwarden) if you use one.
- Or ask for a quick screen-share to do it together.

If anything here is unclear, just ask and someone will walk through it with you —
it usually takes about 15 minutes in total.

*Thank you — once these are in place, your dashboard will switch from sample data
to your live numbers automatically.*

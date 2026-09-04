# Sama Rata

A mobile-first web app for splitting group vacation expenses. Anyone in the trip logs what they paid for and who it should be split between, and the app works out each person's balance and the minimum number of transfers to settle up.

No accounts, no login. A trip lives at a link like `https://your-domain.com/?trip=a1b2c3d4e5` — anyone with that link can view and edit the same trip. The link itself is the only access control, so treat it like a shared secret and only send it to people on the trip.

## How it works

- **Trip**: a name and a currency symbol (defaults to `RM`, editable).
- **Members**: the friends on the trip, added/removed as chips. Removing a member is a soft delete — if they've already logged an expense, they stay visible in Settle Up (marked as removed) so the math stays correct; if they never logged anything, they just disappear.
- **Expenses**: description, amount, who paid, and a checkbox for each member to tick who it should be split between. All active members are ticked by default (so shared costs like accommodation need no extra taps), and the payer is auto-ticked when picked — untick anyone not involved in that particular expense.
- **Settle Up**: each person's balance is what they've paid across all expenses minus their share of the expenses they were ticked on — so a member can owe money on one expense and be owed on another, and it all nets out. The app then computes the *minimum* number of "X pays Y" transfers needed to zero everyone out (greedy debtor/creditor matching), not an everyone-pays-everyone matrix.
- Data isn't live-synced — use the **Refresh** button, or just switch back to the tab (it auto-refreshes on focus).
- **Reset Trip** clears all expenses and members but keeps the same link alive, so you can reuse it.

## 1. Set up the database

You need MySQL (5.7+) or MariaDB with InnoDB support.

```bash
mysql -u root -p -e "CREATE DATABASE sama_rata CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'sama_rata_user'@'localhost' IDENTIFIED BY 'choose-a-strong-password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON sama_rata.* TO 'sama_rata_user'@'localhost'; FLUSH PRIVILEGES;"
mysql -u root -p sama_rata < sql/schema.sql
```

Adjust the database/user names and host as needed for your hosting provider — many shared hosts (cPanel etc.) require you to create the database and user through a control panel instead of the command line, then just run `sql/schema.sql` via phpMyAdmin's "Import" tab.

**Already running Sama Rata with real trip data?** `sql/schema.sql` is the full schema for a brand-new install. If you've already deployed an earlier version, don't re-run it — instead apply the incremental migration for the "who needs to pay" feature:

```bash
mysql -u alhudaDev -p sama-rata < sql/migrations/001_add_expense_participants.sql
```

This adds the new `expense_participants` table and backfills every existing expense to match the old "split among everyone" behavior, so your current Settle Up numbers don't change until you start ticking different people on new expenses.

## 2. Configure the app

```bash
cp api/config.example.php api/config.php
```

Edit `api/config.php` with your real credentials:

```php
$DB_HOST = 'localhost';
$DB_NAME = 'sama_rata';
$DB_USER = 'sama_rata_user';
$DB_PASS = 'choose-a-strong-password';
```

`api/config.php` is gitignored — it never gets committed, so your real credentials stay off GitHub. Only `api/config.example.php` (with placeholder values) is tracked.

## 3. Run it

**Locally, for testing:**

```bash
php -S localhost:8000
```

Open `http://localhost:8000/`.

**On your server:**

The app is plain static files (`index.html`, `css/`, `js/`) plus a PHP API (`api/*.php`) — no build step, no framework, no Composer dependencies. Upload the whole project folder (everything except `.git/` if you cloned it) to your web server's document root, or a subfolder if you're hosting it at a path.

*Apache:* works out of the box on any standard PHP-enabled Apache host (shared hosting, cPanel, etc.) — `index.html` is served automatically at the folder's URL, and the `.php` files under `api/` run as-is. No `.htaccess` is required for the default `?trip=SLUG` query-string link format.

*Nginx:* make sure PHP-FPM is wired up for `.php` files, e.g.:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/sama-rata;
    index index.html;

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

**Use HTTPS.** Since the trip link is the only access control (no login), it should never travel over plain HTTP where it could be sniffed. Any free certificate (Let's Encrypt / your host's built-in SSL) is enough.

## 4. Share a trip

Open the site with no `?trip=` — it'll show a "start a trip" screen. Once created, the address bar becomes something like `your-domain.com/?trip=a1b2c3d4e5`. Copy that URL and send it to everyone on the trip; anyone who opens it sees and can edit the same data.

## Project layout

```
index.html            static shell, no server templating
css/style.css          passport-stamp visual theme
js/                    vanilla ES modules (state, api, settlement math, rendering, app wiring)
api/*.php              PHP + PDO/MySQL backend, one file per endpoint
api/config.php          your real DB credentials (gitignored, create this yourself)
api/config.example.php   placeholder credentials, committed as a template
sql/schema.sql          full schema for a new install: trips, members, expenses, expense_participants
sql/migrations/          incremental migrations for existing deployments
```

## Security notes

- Every database query uses prepared statements — no SQL injection surface.
- Every write is scoped to the trip's own rows — one trip's link can't be used to tamper with another trip's data.
- The trip slug (the part after `?trip=`) is generated from 40 bits of randomness — treat it like a password: don't post it somewhere public if you don't want strangers editing the trip.
- There's no rate limiting built in. If you're deploying somewhere public-facing long-term, consider adding basic rate limiting at the web server level for the `api/` path.

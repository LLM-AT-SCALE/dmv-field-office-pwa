# Deployment

How this application is built, shipped and run on AWS — and the things that
have already gone wrong, so they do not go wrong again.

Current deployment: **https://rfdbdxz8mh.us-west-2.awsapprunner.com**
(App Runner, `us-west-2`, account `881490114847`, single instance, no database.)

---

## 1. Read this before your first deploy

**Synthetic data only.** The running service holds names, addresses and driver
licence numbers in memory, on an AWS account DMV has not reviewed. Fine for a
demo with invented details. Not acceptable for anything real until there is a
security review and DMV-approved infrastructure.

**The counter has no authentication** while `DEMO_STAFF_ID` is set. Anyone with
the URL can read every application at that office. That is the deliberate trade
for showing the counter working before DMV single sign-on exists — the stub in
`lib/server/auth.ts` fails closed otherwise, and logs a warning on first use when
it is opened.

**One instance, on purpose.** The session store is in memory. A second instance
means a customer takes a ticket on one and the technician looks it up on the
other and gets a 404 — the demo failing at the exact moment it should land.

**Restarts clear every ticket.** Since tickets are deleted at close of business
anyway this is close to intended behaviour, but do not redeploy mid-demo.

**Ask DMV IT which account and landing zone this belongs in** before creating
anything in a shared account. A state agency normally has an approved-services
list and a VPC pattern that overrides everything here.

---

## 2. Deploy

```bash
aws sso login          # do this IMMEDIATELY before; see §6
./deploy/build-and-push.sh
./deploy/create-service.sh
```

Roughly six minutes end to end. Both scripts are re-runnable: they create what is
missing and reuse what exists. The second detects an existing service and deploys
the new image to it rather than making a duplicate.

### What each does

**`deploy/build-and-push.sh`** — creates the ECR repository, zips the source
(same exclusions as `.dockerignore`), uploads it to S3, creates the CodeBuild
project and its IAM role if absent, starts the build and waits.

**`deploy/create-service.sh`** — creates the App Runner ECR access role, an
auto-scaling configuration pinned to one instance, and the service with a health
check on `/api/health`; then waits for `RUNNING`.

### Why CodeBuild rather than a local `docker build`

No Docker daemon is needed on your machine, and CodeBuild's runners are already
x86_64 — which removes an entire class of failure described in §5.

---

## 3. What exists in AWS

| Resource | Name | Purpose |
|---|---|---|
| ECR repository | `field-office-pwa` | Container images, scan-on-push |
| S3 bucket | `codebuild-<account>-<region>-src` | Build source, public access blocked |
| IAM role | `FieldOfficePwaCodeBuildRole` | CodeBuild: ECR push, S3 read, logs |
| IAM role | `AppRunnerECRAccessRole` | App Runner pulling from ECR |
| CodeBuild project | `field-office-pwa-build` | Builds the image |
| Auto-scaling config | `single-instance` | min 1, max 1 |
| App Runner service | `field-office-pwa` | 1 vCPU, 2 GB, port 3000 |
| DynamoDB table | `field-office-pwa` | On-demand, `token-index` GSI, TTL on `expires_epoch` |
| IAM role | `FieldOfficePwaInstanceRole` | Container: five DynamoDB actions, one table |

Both IAM roles are broader than a production deployment should have.
`AmazonEC2ContainerRegistryPowerUser` in particular is more than a build needs.
Tighten before anything resembling a pilot.

---

## 4. Environment variables

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Set in the image |
| `PORT` | `3000` | Set in the image |
| `DEMO_STAFF_ID` | e.g. `demo-technician` | **Opens the counter to anyone with the URL.** Absent by default so a deployment that forgets it fails closed rather than opening quietly. Remove for anything beyond a demo. |
| `DYNAMODB_TABLE` | `field-office-pwa` | Selects the DynamoDB store. Unset means in-memory, which does not survive a restart. |

`HOSTNAME` is deliberately **not** set with `ENV` — see §5.

---

## 5. Two failures that have already happened

Both cost a full deploy cycle. Both are fixed. Both will return if the relevant
line is "tidied" without understanding it.

### The image must be x86_64

App Runner does not run ARM images. Built on an Apple Silicon Mac without
`--platform linux/amd64`, the service starts and then dies with
`exec format error`, which reads like a corrupt image rather than an
architecture mismatch.

Building in CodeBuild avoids this entirely — its runners are x86_64 — which is
the main reason to prefer it over building locally.

### The container must not trust `HOSTNAME`

App Runner sets `HOSTNAME` to the container's own hostname, **overriding**
anything declared with `ENV`. Next.js's standalone server reads that variable to
decide what to bind to, so it listens on a single internal interface.

The symptom is unusually misleading: the application starts, logs
`✓ Ready in 0ms`, and looks completely healthy — while every health check fails
for six minutes until the deploy is abandoned. Nothing in the application log
suggests a problem, because from the app's point of view there wasn't one.

The Dockerfile therefore sets it in `CMD`, which is applied at exec time and
wins:

```dockerfile
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
```

**Do not convert this to `ENV HOSTNAME=0.0.0.0`.** It will silently stop working.

### A third, smaller one

CodeBuild runs buildspec commands under `sh` (dash), not bash. Bash-only syntax
such as `${VAR:0:12}` fails with `Bad substitution`. Shell variables also do not
reliably survive a phase boundary, which is why build, tag and push all happen
inside one phase in `deploy/buildspec.yml`.

---

## 6. Credentials

SSO sessions here are short — short enough that a build-plus-deploy cycle can
outlive one. When that happens the failure lands mid-operation, where it is least
obvious: CodeBuild keeps running on AWS and completes, while the local script
loses the ability to poll it and the deploy step never runs.

Run `aws sso login` **immediately** before deploying, not earlier in the session.

If a deploy dies partway, check whether the build actually succeeded before
rebuilding:

```bash
aws codebuild list-builds-for-project --project-name field-office-pwa-build \
  --region us-west-2 --max-items 1
aws ecr describe-images --repository-name field-office-pwa --region us-west-2 \
  --query 'sort_by(imageDetails,&imagePushedAt)[-1].imageTags'
```

If the image is there, skip the rebuild and run `./deploy/create-service.sh`.

---

## 7. QR codes

```bash
npm run poster                                        # deployed app (default)
npm run poster -- --base http://192.168.1.14:3000/o   # a laptop on the LAN
POSTER_BASE_URL=https://dmv.ca.gov/go npm run poster  # a real DMV domain
```

Writes to `QR_code/`: one PNG and one HTML page per office, `index.html` carrying
all three for printing in a single pass, and `counter-url.txt` holding the staff
counter URL as plain text.

**There is no QR code for the counter, on purpose.** It is a staff URL, and a QR
with no context ends up on the lobby wall beside the customer posters. While
`DEMO_STAFF_ID` is set, anyone who scans it can read every application at that
office.

`QR_code/` is a local deliverable and is NOT served by the application, so
regenerating it needs no redeploy. That is deliberate: codes were previously
baked into the image, and the deployed page went on serving LAN addresses that
scanned successfully and then failed on every phone not on that Wi-Fi. Keeping
them out of the image removes the trap.

After the deployed URL changes, regenerate the codes — the old PNGs will keep
pointing at the old address until you do.

---

## 8. The session store

Two implementations behind one `SessionStore` interface. The application picks
between them on a single signal:

| `DYNAMODB_TABLE` | Store | Behaviour |
|---|---|---|
| unset | in memory | `npm run dev` needs no AWS and no table |
| set | DynamoDB | tickets survive restarts and can be shared between instances |

### Why DynamoDB rather than a relational database

The access pattern is key-value: fetch by `session_id`, fetch by token, list one
office's live tickets. Nothing is joined, nothing is queried across records, and
every row is deleted the same day. There is no schema to migrate and no
connection pool to manage.

### Table

`field-office-pwa`, on-demand billing, `us-west-2`.

```
pk    partition key   SESSION#<id> | QUEUE#<office> | AUDIT#<id> | RATE#<key>
sk    sort key        item kind, or an ordering key for audit events
gsi1pk / gsi1sk       token-index: TOKEN#<office> / <token_number>
expires_epoch         TTL attribute
```

Token lookup is office-scoped **by the key**, not by a filter someone could
forget to apply: `TOKEN#<office>` is the partition, so a technician can only
reach tickets at their own office.

### TTL is a backstop, not the mechanism

DynamoDB collects expired items *typically within 48 hours*. This product tells
the customer on screen that their details are deleted at close of business, and
tells the technician the same in the record header. If TTL were the mechanism,
both statements would be false by up to two days.

Deletion therefore happens four ways, in order of authority:

1. explicit `DeleteItem` when the technician completes a transaction
2. `purgeExpired()`, run by the sweeper on its interval
3. **every read filters expired items**, so one not yet collected is never returned
4. TTL removes whatever the first three missed

Point 3 is what keeps the promise true from the outside regardless of what the
table still holds internally. Do not "simplify" it away.

### Setting it up

```bash
./deploy/create-table.sh           # table, GSI, TTL
./deploy/create-instance-role.sh   # what the container may do
./deploy/build-and-push.sh && ./deploy/create-service.sh
```

`create-service.sh` detects the instance role: if it exists, the service gets it
plus `DYNAMODB_TABLE`; if not, the app runs in memory. Both are valid, so a
missing role degrades rather than fails.

### Permissions

`FieldOfficePwaInstanceRole` allows exactly five actions — `GetItem`, `PutItem`,
`UpdateItem`, `DeleteItem`, `Query` — on one table and its index. No `Scan`, no
`ListTables`, no `DeleteTable`. A compromised container cannot enumerate or
destroy anything, and the application never needs to.

This is the **instance** role, not `AppRunnerECRAccessRole`, which only pulls
images. Confusing the two is the usual reason a container cannot reach its table.

### Cost

At one office serving 1,000 customers a day: roughly **$2/month**. Writes
dominate, because DynamoDB bills an update on the size of the whole item rather
than the change — and autosave writes ~50 times against a growing form.

The App Runner instance costs more than the database, at $12–25/month. Polling
is ~90% of reads, so the customer poll interval is the lever if volume ever makes
this matter. It does not at pilot scale.

### If you need expiry that is genuinely immediate

**ElastiCache (Redis/Valkey)** expires on the second rather than within 48 hours,
and the `redis` package is already a dependency. The cost is a VPC, a running
cluster and a continuous bill. Only worth it if the 48-hour TTL window is
unacceptable even as a backstop — which, given deletion is done by the
application anyway, it should not be.

---

## 9. Before a pilot

- **DMV single sign-on** for the counter. `lib/server/auth.ts` is a stub with the
  replacement documented in place, and it fails closed by default.
- **Security review** of the account, the image and the data handling.
- **Tighten the IAM roles** created by the deploy scripts.
- **Certified Spanish review.** The translations are working drafts.
- **A real screen-reader and keyboard pass** by someone who did not write the code.
- **A custom domain**, so posters do not carry an `awsapprunner.com` address.

---

## 10. Teardown

```bash
ARN=$(aws apprunner list-services --region us-west-2 \
  --query "ServiceSummaryList[?ServiceName=='field-office-pwa'].ServiceArn" --output text)
aws apprunner delete-service --service-arn "$ARN" --region us-west-2
```

App Runner bills while a service exists, so delete it when the demo is over. ECR,
S3 and the IAM roles cost almost nothing and are worth keeping for the next
deploy.

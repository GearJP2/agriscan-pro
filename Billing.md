# Billing Estimate

Planning estimate for a small production deployment in AWS Thailand
(`ap-southeast-7`) with up to 10 concurrent users. Prices are USD per month,
assume 730 hours, On-Demand, Single-AZ, and exclude VAT. Use AWS Cost Explorer
as the source of truth.

## Recommended starting point

| Service | Configuration | Estimated monthly cost |
| --- | --- | ---: |
| CloudFront | Free plan: 100 GB transfer, 1M requests, 5 GB S3 | $0 |
| Elastic Beanstalk | Service charge | $0 |
| EC2 | 1 x `t3.small` (2 vCPU, 2 GiB RAM) | $17.37 |
| EBS | 20 GiB gp3 root volume | $1.73 |
| Public IPv4 | 1 address: EB instance only | $3.65 |
| RDS PostgreSQL | Single-AZ `db.t4g.micro` (2 vCPU, 1 GiB) + 20 GiB gp3 | $19.27 |
| S3 uploads | Excel/CSV uploads; actual storage under 20 GiB | <$0.45 |
| **Total** | Fixed 730-hour baseline; excludes S3 and other usage-based items | **$42.02 + usage** |

At roughly THB 33/USD, this is about THB 1,387 before VAT, plus usage-based items.

S3 Standard in Thailand is $0.0225/GiB-month: 1 GiB costs about $0.02,
5 GiB about $0.11, and 20 GiB $0.45. Versioned old uploads and request/data
transfer charges remain usage-based.

## CloudFront

Use one **Free** distribution for the frontend first. It includes CDN, DNS,
TLS, always-on DDoS protection, common-threat WAF coverage, 100 GB transfer,
1M requests, and 5 GB S3 storage. Pro is $15/month and is only needed for
access logs or when the Free allowance is no longer enough.

CloudFront pricing: <https://aws.amazon.com/cloudfront/pricing/>

## Costs to avoid until needed

| Service | Why it costs more |
| --- | --- |
| NAT Gateway | Fixed hourly charge per AZ plus per-GB processing; budget at least $33/month per AZ before data processing. |
| Application Load Balancer | Not created: the EB environment is a single instance. Add only when high availability or horizontal scaling is needed. |
| RDS Multi-AZ | Maintains a standby database; roughly doubles the RDS portion. |
| ElastiCache / Redis | The app defaults to synchronous tasks and local-memory cache, so Redis is not required until async tasks are enabled. |
| CloudWatch logs and RDS snapshots | Small at first, but retention and exports can grow without limits. |

VPC itself is normally free. Public IPv4 addresses cost $0.005/hour each;
NAT Gateway charges are separate. See <https://aws.amazon.com/vpc/pricing/>.

## Project configuration to verify

- The template is intended for Thailand. Deploy the stack with
  `--region ap-southeast-7`; `AWS_S3_REGION_NAME` follows `AWS::Region`.
- `ASYNC_TASKS_ENABLED` defaults to `False`; Redis and Celery should remain
  disabled for this baseline.
- The template defaults to one EB `t3.small`, Single-AZ RDS PostgreSQL
  `db.t4g.micro` with 20 GiB gp3, and no Redis, NAT, or ALB.
  Confirm the live settings before treating this document as an actual bill.

## Budget guardrails

- Create monthly AWS Budgets alerts at THB 2,500 and THB 4,000.
- In Cost Explorer, group by **Service** and then **Usage type**; inspect NAT
  Gateway, public IPv4, RDS backup, CloudWatch, and data-transfer lines first.

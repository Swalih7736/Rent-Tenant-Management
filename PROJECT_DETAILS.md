# RentFlow — Tenant & Rent Management System (Project Overview & Details)

RentFlow is a modern, comprehensive software solution designed to simplify property administration, tenant tracking, and rent collection. It serves as an all-in-one hub for property owners, landlords, and property managers to streamline daily operations, manage lease agreements, log utility readings, and maintain clear financial records.

---

## 🌟 About the Project

Managing rental properties involves tracking multiple moving parts: tenant lifecycles, monthly billing cycles, lease document archives, utility meter updates, and financial collections. 

**RentFlow** resolves these complexities by providing a centralized database and an interactive dashboard. The system replaces error-prone spreadsheets with structured workflows for onboarding tenants, collecting rent, tracking utilities, and managing vacancies. 

### Core Objectives:
1. **Reduce Overdue Payments**: Instantly identify who owes rent and how much is outstanding.
2. **Streamline Tenant Lifecycle**: Seamlessly transition tenants from onboarding (signing agreements) to offboarding (final settlements).
3. **Digitize Document Storage**: Store lease agreements and identity proofs directly within the tenant profile.
4. **Automate Utility Settlement**: Log initial and final electricity meter readings to prevent utility payment disputes.
5. **Analyze Portfolio Performance**: Provide visual insights into occupancy rates, collection efficiencies, and revenue generation.

---

## 👥 User Roles & Permissions

To maintain data integrity and security, RentFlow supports a role-based access model tailored to property management operations:

*   **Administrator (Admin)**
    *   *Who it is:* Property Owner or Lead Administrator.
    *   *Permissions:* Full control over the entire system, including user access management (adding/updating staff roles), database configuration, property modifications, tenant actions, and payment logs.
*   **Manager**
    *   *Who it is:* On-site Property Manager or Rental Agent.
    *   *Permissions:* Operational access to create and modify properties, register and edit tenants, upload files, record electricity readings, and log rent/advance payments. Cannot manage other users or system configurations.
*   **Viewer**
    *   *Who it is:* Landlords, Investors, or Accountants.
    *   *Permissions:* Read-only access. Can browse properties, search tenant records, view payment history, and check financial reports. They cannot create, edit, or delete any data.

---

## 🛠️ Core Functional Modules

### 1. Unified Dashboard (Real-time Analytics)
The homepage of the application provides an operational bird's-eye view of your rental portfolio:
*   **Key Performance Cards**: Total managed properties, occupancy rate (%), current month's total collected revenue, and outstanding rent amount.
*   **Pending Rent Tracker**: An interactive list highlighting active tenants with outstanding rent for the current billing cycle, showing exactly how much they have paid and the remaining balance.

### 2. Property Registry
A detailed catalog of all real estate assets in your portfolio:
*   **Detailed Records**: Track street address, total available units within the building, standard monthly rent amount, and specific occupancy notes.
*   **Unit Breakdown**: View unit statuses and see which unit is currently occupied by which tenant.

### 3. Tenant Lifecycle Tracker
RentFlow manages the entire tenant relationship lifecycle:
*   **Onboarding**:
    *   Log contact info (name, email, phone).
    *   Assign to a property and specify a unit number.
    *   Record lease duration (start date and end date) and customize the monthly due date (e.g., rent due on the 5th of every month).
    *   Upload PDF/image files of signed lease agreements and identity proofs (e.g., driver's license or state ID).
    *   Record the initial electricity meter reading.
*   **Active Tenancy**:
    *   Track rent statuses (Active vs. Past).
    *   Maintain current outstanding dues or advances.
*   **Offboarding**:
    *   Record vacating date and final electricity meter reading.
    *   Calculate final outstanding dues (combining unpaid rent, utility adjustments, and security deposit deductions).
    *   Convert status to "Past" to archive records while keeping payment histories intact.

### 4. Financial Ledger & Payments
A transaction history engine to track incoming capital:
*   **Payment Categorization**: Track payments as either **Rent** (recurring monthly payments) or **Advance** (security deposit paid upfront).
*   **Month Coverage Mapping**: Every rent payment is mapped to a specific calendar month (e.g., `2026-07`) to prevent double-payment entries and enable exact tracking of month-over-month balances.
*   **Memo Notes**: Add descriptions or notes to payments (e.g., "Paid via bank transfer", "Late payment fee included").

### 5. Overdue Dues Overview
A dedicated tracker that aggregates all tenants who have either not paid rent or have only paid partially for the current month. This module displays:
*   Standard monthly rent amount.
*   Total amount paid so far.
*   Total pending balance.
*   Direct access to the tenant's profile to facilitate communications.

### 6. Interactive Visual Reports
Generates business intelligence using clean visual graphs:
*   **Revenue Distribution**: Bar charts showing revenue generated by each property.
*   **Collection Efficiencies**: A comparison of expected revenue (based on occupied units) versus actual rent collected.
*   **Payment Status Composition**: Pie charts segmenting tenants into *Paid*, *Pending* (partial payment), and *Overdue* (no payment) statuses for the current billing period.

---

## 📈 System Workflows

### Tenant Onboarding Flow
```
[Add Tenant Profile] ➔ [Assign Property & Unit] ➔ [Set Lease Dates & Rent Due Day] ➔ [Log Starting Electric Reading] ➔ [Upload ID Proof & Signed Agreement] ➔ [Onboarding Complete (Status: Active)]
```

### Monthly Collection Flow
```
[New Month Starts] ➔ [Rent Balance Generated] ➔ [Tenant Submits Payment] ➔ [Log Payment in RentFlow] ➔ [Map to Targeted Month & Category] ➔ [Dashboard Update (Reflected in Revenue / Removed from Overdue)]
```

### Tenant Offboarding Flow
```
[Tenant Submits Notice] ➔ [Input Vacating Date] ➔ [Log Final Electric Reading] ➔ [Calculate Utility Difference & Remaining Rent] ➔ [Settle Final Dues/Refunds] ➔ [Mark Tenant Status as Past] ➔ [Unit Marked Available]
```

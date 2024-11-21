# Does My Deal Pencil? ✏️™ - Commercial Real Estate Investment Analyzer

A sophisticated web application designed for rapid commercial real estate investment analysis. Perfect for investors, brokers, and analysts who need quick, professional "back of the napkin" calculations with institutional-grade accuracy.

![Preview](./src/assets/preview.png)

## Key Features

### Instant Financial Analysis
- **Cap Rate & NOI Analysis**: Input purchase price and NOI for instant cap rate calculation
- **Debt Coverage**: Calculate DSCR with customizable loan terms
- **Return Metrics**: 
  - Internal Rate of Return (IRR)
  - Cash-on-Cash Return
  - Equity Multiple
  - Return on Investment (ROI)
- **Operating Metrics**:
  - Break-even Occupancy
  - Operating Expense Ratio
  - Effective Gross Income

### Smart Deal Assessment
- **Visual Status Indicators**:
  - 🟢 Green Checkmark: Strong deal metrics (DSCR ≥ 1.25, IRR ≥ 15%, Cash-on-Cash ≥ 8%)
  - 🟡 Yellow Warning: Moderate potential (DSCR ≥ 1.1, IRR ≥ 10%, Cash-on-Cash ≥ 6%)
  - 🔴 Red Alert: Deal needs significant review (metrics below moderate thresholds)

### Professional PDF Reports
- **One-Click Generation**: Instantly create professional investment summaries
- **Comprehensive Sections**:
  - Property Overview & Financial Summary
  - Key Performance Metrics Dashboard
  - Deal Analysis & Investment Strategy
  - Risk Assessment (Strengths & Weaknesses)
  - Professional Recommendations
  - Exit Strategy Analysis
- **Clean, Professional Format**: 
  - Branded headers and sections
  - Clear data visualization
  - Executive-ready presentation
  - Shareable PDF format

### User Experience
- **Intuitive Interface**: Clean, modern design with real-time calculations
- **Mobile Responsive**: Analyze deals on any device
- **Smart Validation**: Prevents common input errors
- **Instant Feedback**: See results as you type

## Technical Features

- **Frontend**: React 18 with TypeScript for type safety
- **Form Management**: Formik with Yup validation
- **Styling**: Tailwind CSS for modern, responsive design
- **PDF Generation**: jsPDF with autoTable for professional reports
- **Icons**: Heroicons for consistent visual language
- **Performance**: Client-side calculations for instant results

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/tony-42069/cre-analyzer.git
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm start
```

4. Build for production:
```bash
npm run build
```

## Live Demo

Try it now at [AB|Z Advisors CRE Analyzer](https://www.abizadvisors.com/cre-analyzer)

## Usage Guide

### Basic Analysis
1. **Input Property Details**:
   - Purchase price
   - Current NOI
   - Property type and characteristics

2. **Set Financial Parameters**:
   - Cap rates (entry and exit)
   - Holding period
   - NOI growth assumptions
   - Operating expense ratios

3. **Debt Structure**:
   - Loan-to-Value (LTV)
   - Interest rate
   - Amortization period
   - Optional interest-only period

### Advanced Features
1. **Detailed Analysis**:
   - Operating expense adjustments
   - CapEx planning
   - Debt service analysis
   - Break-even calculations

2. **Professional Reporting**:
   - Click "Download PDF" for instant report
   - Complete investment analysis
   - Professional formatting
   - Ready for stakeholder presentation

3. **Deal Assessment**:
   - Color-coded deal indicators
   - Comprehensive strengths/weaknesses
   - Investment recommendations
   - Risk analysis

## Future Enhancements

- User authentication for saved deals
- Advanced sensitivity analysis
- Custom report branding
- Portfolio analysis tools
- Market comparison features
- Scenario modeling
- Investment portfolio tracking

## License

 2024 AB|Z Advisors. All rights reserved.

---
*"Does My Deal Pencil? ✏️"™ is a trademark of AB|Z Advisors*

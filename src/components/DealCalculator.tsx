import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { motion } from 'framer-motion';
import { 
  ArrowTrendingUpIcon, 
  DocumentTextIcon, 
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  DocumentChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import backgroundImage from '../assets/background.png';
import '../styles/custom.css';

interface FormValues {
  purchasePrice: number;
  annualNOI: number;
  noiGrowthRate: number;
  holdingPeriod: number;
  exitCapRate: number;
  ltv: number;
  interestRate: number;
  amortization: number;
  operatingExpenseRatio: number;
  ioPeriod: number;
  capexYear1: number;
  capexYear2: number;
  rehabPeriod: number;
  rehabVacancy: number;
  sellingCosts: number;
}

interface CalculationResults {
  equityInvestment: number;
  loanAmount: number;
  monthlyPayment: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  year1CashFlow: number;
  exitValue: number;
  netSalesProceeds: number;
  irr: number;
  cashOnCash: number;
  dscr: number;
  equityMultiple: number;
  breakEvenOccupancy: number;
  npv: number;
  projectedCashFlows: number[];
  year1NOI: number;
  annualDebtService: number;
  capRate: number;
}

interface DealStatus {
  status: 'good' | 'moderate' | 'poor';
  message: string;
  icon: JSX.Element;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface DealAnalysis {
  dealStatus: DealStatus;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

const validationSchema = Yup.object().shape({
  purchasePrice: Yup.number().required('Required').positive('Must be positive'),
  annualNOI: Yup.number().required('Required').positive('Must be positive'),
  noiGrowthRate: Yup.number().required('Required'),
  holdingPeriod: Yup.number().required('Required').positive('Must be positive').integer('Must be whole number'),
  exitCapRate: Yup.number().required('Required').positive('Must be positive'),
  ltv: Yup.number().required('Required').min(0, 'Must be at least 0').max(100, 'Must be at most 100'),
  interestRate: Yup.number().required('Required').min(0, 'Must be at least 0'),
  amortization: Yup.number().required('Required').min(0, 'Must be at least 0'),
  operatingExpenseRatio: Yup.number().required('Required').min(0, 'Must be at least 0').max(100, 'Must be at most 100'),
  ioPeriod: Yup.number().min(0, 'Must be at least 0').max(Yup.ref('holdingPeriod'), 'Cannot exceed holding period'),
  capexYear1: Yup.number().min(0, 'Must be at least 0'),
  capexYear2: Yup.number().min(0, 'Must be at least 0'),
  rehabPeriod: Yup.number().min(0, 'Must be at least 0'),
  rehabVacancy: Yup.number().min(0, 'Must be at least 0').max(100, 'Must be at most 100'),
  sellingCosts: Yup.number().min(0, 'Must be at least 0').max(100, 'Must be at most 100'),
});

const calculateRemainingLoanBalance = (
  principal: number,
  annualRate: number,
  amortYears: number,
  elapsedYears: number,
  ioPeriod: number
): number => {
  const monthlyRate = annualRate / 1200;
  const totalPayments = amortYears * 12;
  const elapsedPayments = elapsedYears * 12;
  const monthlyPayment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1);
  
  let balance = principal;
  for (let i = 0; i < elapsedPayments; i++) {
    const interest = balance * monthlyRate;
    let principalPaid;
    if (i < ioPeriod * 12) {
      principalPaid = 0;
    } else {
      principalPaid = monthlyPayment - interest;
    }
    balance -= principalPaid;
  }
  return Math.max(0, balance);
};

const calculateProjectedCashFlows = (
  year1CashFlow: number,
  noiGrowthRate: number,
  holdingPeriod: number,
  capexYear1: number,
  capexYear2: number,
  rehabPeriod: number,
  rehabVacancy: number,
  ioPeriod: number,
  monthlyDebtService: number,
  loanAmount: number,
  interestRate: number
): number[] => {
  const cashFlows: number[] = [];
  
  // Initial investment (negative cash flow)
  cashFlows.push(-loanAmount);

  for (let year = 1; year <= holdingPeriod; year++) {
    let yearCashFlow = year1CashFlow * Math.pow(1 + noiGrowthRate / 100, year - 1);
    
    // Apply rehab vacancy impact in first year
    if (year === 1 && rehabPeriod > 0) {
      const rehabImpact = (rehabPeriod / 12) * (rehabVacancy / 100);
      yearCashFlow *= (1 - rehabImpact);
    }

    // Subtract CapEx for years 1 and 2
    if (year === 1) yearCashFlow -= capexYear1;
    if (year === 2) yearCashFlow -= capexYear2;

    // Calculate debt service based on IO period
    let yearlyDebtService;
    if (year <= ioPeriod) {
      // During IO period, only pay interest
      yearlyDebtService = loanAmount * (interestRate / 100);
    } else {
      // After IO period, pay full debt service
      yearlyDebtService = monthlyDebtService * 12;
    }

    yearCashFlow -= yearlyDebtService;
    cashFlows.push(yearCashFlow);
  }

  return cashFlows;
};

const calculateIRR = (cashFlows: number[]): number => {
  const guess = 0.1;
  const maxIterations = 100;
  const tolerance = 0.000001;
  
  const npv = (rate: number): number => {
    return cashFlows.reduce((sum, cf, i) => {
      return sum + cf / Math.pow(1 + rate, i);
    }, 0);
  };
  
  let rate = guess;
  for (let i = 0; i < maxIterations; i++) {
    const value = npv(rate);
    if (Math.abs(value) < tolerance) {
      return rate * 100;
    }
    
    const derivative = cashFlows.reduce((sum, cf, i) => {
      return sum - i * cf / Math.pow(1 + rate, i + 1);
    }, 0);
    
    rate = rate - value / derivative;
  }
  return rate * 100;
};

const calculateNPV = (cashFlows: number[], discountRate: number): number => {
  return cashFlows.reduce((sum, cf, i) => {
    return sum + cf / Math.pow(1 + discountRate, i);
  }, 0);
};

const calculateMetrics = (values: FormValues): CalculationResults => {
  const { purchasePrice, annualNOI, noiGrowthRate, holdingPeriod, exitCapRate, ltv, interestRate, amortization, operatingExpenseRatio } = values;
  
  // Calculate loan details
  const loanAmount = (purchasePrice * ltv) / 100;
  const equityInvestment = purchasePrice - loanAmount;
  
  // Calculate monthly debt service (if not in IO period)
  const monthlyPayment = loanAmount * (interestRate / 1200) * (1 + interestRate / 1200) ** (amortization * 12) / ((1 + interestRate / 1200) ** (amortization * 12) - 1);
  const annualDebtService = monthlyPayment * 12;
  
  // Calculate Year 1 Cash Flow
  const operatingExpenses = (annualNOI * operatingExpenseRatio) / 100;
  const effectiveGrossIncome = annualNOI + operatingExpenses;
  const year1CashFlow = annualNOI;
  const year1NOI = annualNOI;

  // Calculate exit value and proceeds
  const exitNOI = annualNOI * Math.pow(1 + noiGrowthRate / 100, holdingPeriod);
  const exitValue = exitNOI / (exitCapRate / 100);
  const remainingLoanBalance = calculateRemainingLoanBalance(
    loanAmount,
    values.interestRate,
    amortization, // Pass amortization to loan balance calculation
    values.holdingPeriod,
    values.ioPeriod // Pass IO period to loan balance calculation
  );
  
  const sellingCosts = exitValue * (values.sellingCosts / 100);
  const netSalesProceeds = exitValue - remainingLoanBalance - sellingCosts;

  // Calculate cash flows including new parameters
  const projectedCashFlows = calculateProjectedCashFlows(
    year1CashFlow,
    noiGrowthRate,
    holdingPeriod,
    values.capexYear1,
    values.capexYear2,
    values.rehabPeriod,
    values.rehabVacancy,
    values.ioPeriod,
    monthlyPayment,
    loanAmount,
    interestRate
  );

  // Add sales proceeds to final year
  projectedCashFlows[projectedCashFlows.length - 1] += netSalesProceeds;

  // Calculate IRR
  const irr = calculateIRR(projectedCashFlows);
  
  // Calculate cash-on-cash return
  const cashOnCash = (year1CashFlow / equityInvestment) * 100;
  
  // Calculate debt service coverage ratio
  const dscr = annualNOI / (monthlyPayment * 12);

  // Calculate equity multiple
  const totalCashFlow = projectedCashFlows.reduce((sum, cf) => sum + cf, 0);
  const equityMultiple = totalCashFlow / Math.abs(projectedCashFlows[0]);

  // Calculate NPV
  const npv = calculateNPV(projectedCashFlows, 0.10); // Using 10% discount rate

  // Calculate break-even occupancy
  const breakEvenOccupancy = (monthlyPayment * 12 + operatingExpenses) / effectiveGrossIncome;

  // Calculate cap rate
  const capRate = (values.annualNOI / values.purchasePrice) * 100;

  return {
    equityInvestment,
    loanAmount,
    monthlyPayment,
    annualDebtService,
    effectiveGrossIncome,
    operatingExpenses,
    year1CashFlow,
    exitValue,
    netSalesProceeds,
    irr,
    cashOnCash,
    dscr,
    equityMultiple,
    breakEvenOccupancy,
    npv,
    projectedCashFlows,
    year1NOI,
    capRate,
  };
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

const generatePDF = (values: FormValues, results: CalculationResults) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;
  
  // Helper function for centered text
  const addCenteredText = (text: string, y: number, size = 16) => {
    doc.setFontSize(size);
    const textWidth = doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor;
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };

  // Helper function for section headers
  const addSectionHeader = (text: string, y: number) => {
    doc.setFillColor(52, 144, 220);
    doc.rect(margin, y - 6, pageWidth - (margin * 2), 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(text, margin + 2, y);
    doc.setTextColor(0, 0, 0);
    return y + 10;
  };

  // Title and Header
  doc.setFont("helvetica", "bold");
  addCenteredText("Commercial Real Estate Investment Analysis", 20);
  doc.setFont("helvetica", "normal");
  addCenteredText("Does My Deal Pencil?™", 30, 14);
  doc.setFontSize(10);
  addCenteredText("Generated by Alliance Business Advisors", 38);
  doc.setDrawColor(52, 144, 220);
  doc.line(margin, 42, pageWidth - margin, 42);

  // Property Details
  let currentY = addSectionHeader("Property Details", 55);
  const propertyDetails = [
    ['Purchase Price', formatCurrency(values.purchasePrice)],
    ['Annual NOI', formatCurrency(values.annualNOI)],
    ['NOI Growth Rate', formatPercent(values.noiGrowthRate)],
    ['Holding Period', values.holdingPeriod + ' months'],
    ['Exit Cap Rate', formatPercent(values.exitCapRate)],
    ['Interest Rate', formatPercent(values.interestRate)],
    ['Amortization', values.amortization + ' years'],
    ['LTV', formatPercent(values.ltv)]
  ];

  doc.autoTable({
    startY: currentY,
    head: [],
    body: propertyDetails,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 50 }
    },
    margin: { left: margin }
  });

  // Key Metrics
  currentY = doc.lastAutoTable.finalY + 15;
  currentY = addSectionHeader("Key Performance Metrics", currentY);

  const metrics = [
    ['Cash on Cash Return', formatPercent(results.cashOnCash)],
    ['Cap Rate', formatPercent(results.capRate)],
    ['Equity Multiple', results.equityMultiple.toFixed(2) + 'x'],
    ['IRR', formatPercent(results.irr)],
    ['Debt Service Coverage', results.dscr.toFixed(2)],
    ['Break-even Occupancy', formatPercent(results.breakEvenOccupancy)],
    ['NPV', formatCurrency(results.npv)]
  ];

  doc.autoTable({
    startY: currentY,
    head: [],
    body: metrics,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 50 }
    },
    margin: { left: margin }
  });

  // Deal Analysis
  const analysis = generateDealAnalysis(results);
  currentY = doc.lastAutoTable.finalY + 15;
  currentY = addSectionHeader("Deal Analysis", currentY);

  // Deal Status
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Overall Assessment:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  // Handle multi-line text for assessment
  const splitAssessment = doc.splitTextToSize(analysis.dealStatus.message, pageWidth - (margin * 2));
  doc.text(splitAssessment, margin, currentY + 7);
  currentY += (splitAssessment.length * 7) + 10;

  // Strengths
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Key Strengths:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  currentY += 7;
  
  analysis.analysis.strengths.forEach((strength) => {
    const splitStrength = doc.splitTextToSize(`• ${strength}`, pageWidth - (margin * 2) - 5);
    doc.text(splitStrength, margin + 3, currentY);
    currentY += (splitStrength.length * 5) + 3;
  });

  // Weaknesses
  currentY += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Areas of Concern:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  currentY += 7;

  analysis.analysis.weaknesses.forEach((weakness) => {
    const splitWeakness = doc.splitTextToSize(`• ${weakness}`, pageWidth - (margin * 2) - 5);
    doc.text(splitWeakness, margin + 3, currentY);
    currentY += (splitWeakness.length * 5) + 3;
  });

  // Recommendations
  currentY += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Recommendations:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  currentY += 7;

  analysis.analysis.recommendations.forEach((rec) => {
    const splitRec = doc.splitTextToSize(`• ${rec}`, pageWidth - (margin * 2) - 5);
    doc.text(splitRec, margin + 3, currentY);
    currentY += (splitRec.length * 5) + 3;
  });

  // Footer
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  addCenteredText("For more information or to discuss financing options, contact:", footerY);
  addCenteredText("Daniel Sadellari | dsadellari@abizadvisors.com | www.abizadvisors.com", footerY + 5);

  return doc;
};

const handleDownloadPDF = (values: FormValues, results: CalculationResults) => {
  const doc = generatePDF(values, results);
  doc.save('deal-analysis.pdf');
};

const getDealStatus = (metrics: CalculationResults): DealStatus => {
  const { irr, dscr, breakEvenOccupancy, cashOnCash } = metrics;
  
  if (dscr >= 1.25 && irr >= 15 && cashOnCash >= 8) {
    return {
      status: 'good',
      message: 'This deal shows strong potential with good cash flow coverage and returns.',
      icon: <CheckCircleIcon className="w-8 h-8 text-emerald-400" />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      borderColor: 'border-emerald-400/30'
    };
  } else if (dscr >= 1.1 && irr >= 10 && cashOnCash >= 6) {
    return {
      status: 'moderate',
      message: 'This deal shows moderate potential but careful consideration is needed.',
      icon: <ExclamationTriangleIcon className="w-8 h-8 text-amber-400" />,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      borderColor: 'border-amber-400/30'
    };
  } else {
    return {
      status: 'poor',
      message: 'This deal shows concerning metrics and requires significant review.',
      icon: <XCircleIcon className="w-8 h-8 text-rose-400" />,
      color: 'text-rose-400',
      bgColor: 'bg-rose-400/10',
      borderColor: 'border-rose-400/30'
    };
  }
};

const generateDealAnalysis = (metrics: CalculationResults): DealAnalysis => {
  const { irr, dscr, breakEvenOccupancy, cashOnCash, equityMultiple } = metrics;
  const dealStatus = getDealStatus(metrics);
  
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  // Analyze IRR
  if (irr > 15) {
    strengths.push("Strong IRR indicating excellent potential returns");
  } else if (irr > 10) {
    strengths.push("Acceptable IRR within market expectations");
  } else {
    weaknesses.push("Below-market IRR suggests potential return challenges");
  }

  // Analyze DSCR
  if (dscr > 1.25) {
    strengths.push("Strong debt service coverage provides safety margin");
  } else if (dscr > 1.1) {
    weaknesses.push("Tight debt service coverage - monitor cash flows carefully");
  } else {
    weaknesses.push("Concerning debt service coverage - high default risk");
  }

  // Analyze Cash on Cash
  if (cashOnCash > 8) {
    strengths.push("Excellent cash-on-cash return");
  } else if (cashOnCash > 6) {
    strengths.push("Decent cash flow generation potential");
  } else {
    weaknesses.push("Limited cash flow potential");
  }

  // Analyze Break-even Occupancy
  if (breakEvenOccupancy < 0.75) {
    strengths.push("Low break-even occupancy provides good downside protection");
  } else if (breakEvenOccupancy < 0.85) {
    weaknesses.push("Moderate break-even occupancy - limited vacancy buffer");
  } else {
    weaknesses.push("High break-even occupancy increases risk profile");
  }

  // Generate Recommendations
  if (dealStatus.status === 'good') {
    recommendations.push(
      "Strong acquisition target with multiple positive indicators",
      "Consider locking in long-term fixed-rate debt",
      "Implement value-add strategies to further enhance returns"
    );
  } else if (dealStatus.status === 'moderate') {
    recommendations.push(
      "Deal shows promise but requires risk mitigation",
      "Negotiate purchase price to improve returns",
      "Explore ways to enhance NOI through operational improvements"
    );
  } else {
    recommendations.push(
      "Consider passing on this opportunity",
      "If pursuing, substantial price reduction needed",
      "Major operational improvements required to make numbers work"
    );
  }

  return {
    dealStatus,
    analysis: {
      strengths,
      weaknesses,
      recommendations
    }
  };
};

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: string, setFieldValue: (field: string, value: any) => void) => {
  const value = e.target.value;
  if (value === '') {
    setFieldValue(field, '');
  } else {
    const numberValue = parseFloat(value);
    if (!isNaN(numberValue)) {
      setFieldValue(field, numberValue);
    }
  }
};

const DealCalculator: React.FC = () => {
  const [calculationResults, setCalculationResults] = useState<CalculationResults | null>(null);
  const [dealAnalysis, setDealAnalysis] = useState<DealAnalysis | null>(null);

  // Set background image on mount
  React.useEffect(() => {
    document.documentElement.style.setProperty('--bg-image', `url(${backgroundImage})`);
  }, []);

  const initialValues: FormValues = {
    purchasePrice: 1750000,
    annualNOI: 300000,
    noiGrowthRate: 2,
    holdingPeriod: 60,
    exitCapRate: 6,
    ltv: 75,
    interestRate: 6.5,
    amortization: 25,
    operatingExpenseRatio: 40,
    ioPeriod: 0,
    capexYear1: 0,
    capexYear2: 0,
    rehabPeriod: 0,
    rehabVacancy: 0,
    sellingCosts: 4, // Default 4% selling costs
  };

  const handleSubmit = (values: FormValues, { setSubmitting }: FormikHelpers<FormValues>) => {
    const results = calculateMetrics(values);
    setCalculationResults(results);
    setDealAnalysis(generateDealAnalysis(results));
    setSubmitting(false); // This will re-enable the button
  };

  return (
    <div 
      className="container mx-auto px-4 py-8"
      style={{
        backgroundImage: 'var(--bg-image)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="text-center mb-8">
        <motion.h1 
          className="text-5xl font-bold text-white font-space-grotesk tracking-tight mb-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.3 }}
        >
          Does my deal pencil? ✏️
        </motion.h1>
        <motion.p
          className="text-gray-300 text-lg font-space-grotesk"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Your quick "back of the napkin" commercial real estate deal analyzer
        </motion.p>
      </div>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, isSubmitting, setFieldValue, setFieldTouched }) => (
          <Form className="space-y-8">
            <motion.div 
              className="glass-card p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-space-grotesk font-bold mb-6 text-center">
                Investment Parameters
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                <div className="input-group">
                  <label className="input-label">Purchase Price ($)</label>
                  <input
                    type="text"
                    value={values.purchasePrice.toLocaleString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFieldValue('purchasePrice', Number(value));
                    }}
                    onBlur={() => setFieldTouched('purchasePrice', true)}
                    className="input-field"
                    placeholder="$0"
                  />
                  {touched.purchasePrice && errors.purchasePrice && (
                    <div className="text-red-400 text-xs">{errors.purchasePrice}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Annual NOI ($)</label>
                  <input
                    type="text"
                    value={values.annualNOI.toLocaleString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFieldValue('annualNOI', Number(value));
                    }}
                    onBlur={() => setFieldTouched('annualNOI', true)}
                    className="input-field"
                    placeholder="$0"
                  />
                  {touched.annualNOI && errors.annualNOI && (
                    <div className="text-red-400 text-xs">{errors.annualNOI}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">NOI Growth (%/year)</label>
                  <Field
                    name="noiGrowthRate"
                    type="number"
                    className="input-field"
                  />
                  {errors.noiGrowthRate && touched.noiGrowthRate && (
                    <div className="text-red-400 text-xs">{errors.noiGrowthRate}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Holding Period (months)</label>
                  <input
                    type="text"
                    value={values.holdingPeriod}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFieldValue('holdingPeriod', Number(value));
                    }}
                    onBlur={() => setFieldTouched('holdingPeriod', true)}
                    className="input-field"
                    placeholder="60"
                  />
                  {touched.holdingPeriod && errors.holdingPeriod && (
                    <div className="text-red-400 text-xs">{errors.holdingPeriod}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Exit Cap Rate (%)</label>
                  <Field
                    name="exitCapRate"
                    type="number"
                    className="input-field"
                  />
                  {errors.exitCapRate && touched.exitCapRate && (
                    <div className="text-red-400 text-xs">{errors.exitCapRate}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">LTV (%)</label>
                  <Field
                    name="ltv"
                    type="number"
                    className="input-field"
                  />
                  {errors.ltv && touched.ltv && (
                    <div className="text-red-400 text-xs">{errors.ltv}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Interest Rate (%)</label>
                  <Field
                    name="interestRate"
                    type="number"
                    className="input-field"
                  />
                  {errors.interestRate && touched.interestRate && (
                    <div className="text-red-400 text-xs">{errors.interestRate}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Amortization (years)</label>
                  <Field
                    name="amortization"
                    type="number"
                    className="input-field"
                  />
                  {errors.amortization && touched.amortization && (
                    <div className="text-red-400 text-xs">{errors.amortization}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Operating Expense Ratio (%)</label>
                  <Field
                    name="operatingExpenseRatio"
                    type="number"
                    className="input-field"
                  />
                  {errors.operatingExpenseRatio && touched.operatingExpenseRatio && (
                    <div className="text-red-400 text-xs">{errors.operatingExpenseRatio}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Interest Only Period (months)</label>
                  <input
                    type="text"
                    value={values.ioPeriod}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFieldValue('ioPeriod', Number(value));
                    }}
                    onBlur={() => setFieldTouched('ioPeriod', true)}
                    className="input-field"
                    placeholder="0"
                  />
                  {touched.ioPeriod && errors.ioPeriod && (
                    <div className="text-red-400 text-xs">{errors.ioPeriod}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">CapEx Year 1 ($)</label>
                  <input
                    type="text"
                    value={values.capexYear1.toLocaleString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFieldValue('capexYear1', Number(value));
                    }}
                    onBlur={() => setFieldTouched('capexYear1', true)}
                    className="input-field"
                    placeholder="$0"
                  />
                  {touched.capexYear1 && errors.capexYear1 && (
                    <div className="text-red-400 text-xs">{errors.capexYear1}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">CapEx Year 2 ($)</label>
                  <input
                    type="text"
                    value={values.capexYear2.toLocaleString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFieldValue('capexYear2', Number(value));
                    }}
                    onBlur={() => setFieldTouched('capexYear2', true)}
                    className="input-field"
                    placeholder="$0"
                  />
                  {touched.capexYear2 && errors.capexYear2 && (
                    <div className="text-red-400 text-xs">{errors.capexYear2}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Rehab Period (months)</label>
                  <input
                    type="text"
                    value={values.rehabPeriod}
                    onChange={(e) => handleInputChange(e, 'rehabPeriod', setFieldValue)}
                    onBlur={() => setFieldTouched('rehabPeriod', true)}
                    className="input-field"
                  />
                  {touched.rehabPeriod && errors.rehabPeriod && (
                    <div className="text-red-400 text-xs">{errors.rehabPeriod}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Rehab Vacancy (%)</label>
                  <input
                    type="text"
                    value={values.rehabVacancy}
                    onChange={(e) => handleInputChange(e, 'rehabVacancy', setFieldValue)}
                    onBlur={() => setFieldTouched('rehabVacancy', true)}
                    className="input-field"
                  />
                  {touched.rehabVacancy && errors.rehabVacancy && (
                    <div className="text-red-400 text-xs">{errors.rehabVacancy}</div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Selling Costs (%)</label>
                  <input
                    type="text"
                    value={values.sellingCosts}
                    onChange={(e) => handleInputChange(e, 'sellingCosts', setFieldValue)}
                    onBlur={() => setFieldTouched('sellingCosts', true)}
                    className="input-field"
                  />
                  {touched.sellingCosts && errors.sellingCosts && (
                    <div className="text-red-400 text-xs">{errors.sellingCosts}</div>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-8 py-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                  isSubmitting 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </div>
                ) : (
                  'Analyze Deal'
                )}
              </button>
            </motion.div>

            {calculationResults && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="metric-card">
                    <div className="metric-label">Internal Rate of Return (IRR)</div>
                    <div className="metric-value">{formatPercent(calculationResults.irr)}</div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-label">Net Present Value (NPV)</div>
                    <div className="metric-value">{formatCurrency(calculationResults.npv)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Cash-on-Cash Return</div>
                    <div className="metric-value">{formatPercent(calculationResults.cashOnCash)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Equity Multiple</div>
                    <div className="metric-value">{calculationResults.equityMultiple.toFixed(2)}x</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Debt Service Coverage Ratio (DSCR)</div>
                    <div className="metric-value">{calculationResults.dscr.toFixed(2)}x</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Break-Even Occupancy</div>
                    <div className="metric-value">{formatPercent(calculationResults.breakEvenOccupancy)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Year 1 NOI</div>
                    <div className="metric-value">{formatCurrency(calculationResults.year1NOI)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Year 1 Cash Flow</div>
                    <div className="metric-value">{formatCurrency(calculationResults.year1CashFlow)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Effective Gross Income</div>
                    <div className="metric-value">{formatCurrency(calculationResults.effectiveGrossIncome)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Operating Expenses</div>
                    <div className="metric-value">{formatCurrency(calculationResults.operatingExpenses)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Monthly Payment</div>
                    <div className="metric-value">{formatCurrency(calculationResults.monthlyPayment)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Annual Debt Service</div>
                    <div className="metric-value">{formatCurrency(calculationResults.annualDebtService)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Cap Rate</div>
                    <div className="metric-value">{formatPercent(calculationResults.capRate)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="analysis-card">
                    <h3 className="analysis-title">
                      <DocumentChartBarIcon className="h-6 w-6" />
                      Key Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="metric-card">
                        <div className="metric-label">IRR</div>
                        <div className="metric-value">{formatPercent(calculationResults.irr)}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Cash on Cash</div>
                        <div className="metric-value">{formatPercent(calculationResults.cashOnCash)}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Equity Multiple</div>
                        <div className="metric-value">{calculationResults.equityMultiple.toFixed(2)}x</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">DSCR</div>
                        <div className="metric-value">{calculationResults.dscr.toFixed(2)}x</div>
                      </div>
                    </div>
                  </div>

                  {dealAnalysis && (
                    <div className={`analysis-card ${dealAnalysis.dealStatus.bgColor} ${dealAnalysis.dealStatus.borderColor}`}>
                      <div className="flex items-center gap-3 mb-6">
                        <h3 className={`analysis-title ${dealAnalysis.dealStatus.color} flex-grow`}>
                          <ChatBubbleBottomCenterTextIcon className="h-6 w-6" />
                          Deal Analysis
                        </h3>
                        {dealAnalysis.dealStatus.icon}
                      </div>
                      
                      <div className="space-y-6">
                        {dealAnalysis.analysis.strengths.length > 0 && (
                          <div>
                            <h4 className="text-emerald-300 font-semibold mb-2">Strengths</h4>
                            <ul className="list-disc list-inside space-y-1 text-emerald-100">
                              {dealAnalysis.analysis.strengths.map((strength: string, idx: number) => (
                                <li key={idx}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {dealAnalysis.analysis.weaknesses.length > 0 && (
                          <div>
                            <h4 className="text-rose-300 font-semibold mb-2">Concerns</h4>
                            <ul className="list-disc list-inside space-y-1 text-rose-100">
                              {dealAnalysis.analysis.weaknesses.map((weakness: string, idx: number) => (
                                <li key={idx}>{weakness}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="text-blue-300 font-semibold mb-2">Recommendations</h4>
                          <ul className="list-disc list-inside space-y-1 text-blue-100">
                            {dealAnalysis.analysis.recommendations.map((rec: string, idx: number) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 justify-end">
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(values, calculationResults)}
                    className="gradient-button flex items-center space-x-2"
                  >
                    <DocumentTextIcon className="h-5 w-5" />
                    <span>Download PDF Report</span>
                  </button>
                </div>
              </motion.div>
            )}
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default DealCalculator;

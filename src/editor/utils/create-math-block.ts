const randomLatex = [
  "E = mc^2",
  "F = ma",
  "a^2 + b^2 = c^2",
  "e^{i\\pi} + 1 = 0",
  "y = mx + b",
  "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  "A = \\pi r^2",
  "C = 2\\pi r",
  "V = \\frac{4}{3}\\pi r^3",
  "P = 2(l+w)",
  "A = lw",
  "A = \\frac{1}{2}bh",
  "c^2 = a^2 + b^2",
  "\\sin^2 x + \\cos^2 x = 1",
  "\\tan x = \\frac{\\sin x}{\\cos x}",
  "\\sin 2x = 2\\sin x\\cos x",
  "\\cos 2x = \\cos^2 x - \\sin^2 x",
  "\\frac{d}{dx}x^n = nx^{n-1}",
  "\\frac{d}{dx}e^x = e^x",
  "\\frac{d}{dx}\\ln x = \\frac{1}{x}",
  "\\int x^n dx = \\frac{x^{n+1}}{n+1}",
  "\\int e^x dx = e^x + C",
  "\\lim_{x\\to0}\\frac{\\sin x}{x} = 1",
  "PV = nRT",
  "V = IR",
  "P = VI",
  "p = mv",
  "E = hf",
  "v = f\\lambda",
  "W = Fd",
  "P = \\frac{W}{t}",
  "K = \\frac{1}{2}mv^2",
  "U = mgh",
  "Q = mc\\Delta T",
  "F = G\\frac{m_1m_2}{r^2}",
  "I = \\frac{Q}{t}",
  "\\rho = \\frac{m}{V}",
  "d = vt",
  "s = ut + \\frac{1}{2}at^2",
  "v = u + at",
  "v^2 = u^2 + 2as",
  "\\mu = \\frac{1}{n}\\sum x_i",
  "\\sigma^2 = \\frac{1}{n}\\sum(x_i-\\mu)^2",
  "P(A) = \\frac{n(A)}{n(S)}",
  "P(A\\mid B) = \\frac{P(A\\cap B)}{P(B)}",
  "n! = n(n-1)!",
  "\\binom{n}{k} = \\frac{n!}{k!(n-k)!}",
  "F_n = F_{n-1} + F_{n-2}",
  "\\sum_{i=1}^n i = \\frac{n(n+1)}{2}",
  "\\sum_{i=1}^n i^2 = \\frac{n(n+1)(2n+1)}{6}",
  "\\log(ab) = \\log a + \\log b",
  "\\ln(e^x) = x",
  "e^{\\ln x} = x",
  "i^2 = -1",
  "\\varphi = \\frac{1+\\sqrt5}{2}",
  "\\pi \\approx 3.14159",
  "e \\approx 2.71828",
  "\\LaTeX"
]
export const createMathBlock = ()=>{


    return {
        type:"blockMath",
        attrs:{
            //ini pake random latex aja
            latex:randomLatex[
        Math.floor(Math.random() * randomLatex.length)
    ]
        }
    }
}
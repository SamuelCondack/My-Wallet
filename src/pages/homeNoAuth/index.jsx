import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { TRIAL_DAYS } from "../../constants/subscription";
import styles from "./styles.module.scss";

const ease = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.85, ease },
  }),
};

const previewBars = [
  { height: "42%", delay: 0.62 },
  { height: "68%", delay: 0.7 },
  { height: "55%", delay: 0.78 },
  { height: "86%", delay: 0.86, active: true },
  { height: "48%", delay: 0.94 },
  { height: "62%", delay: 1.02 },
];

export default function HomeNoAuth() {
  const reduceMotion = useReducedMotion();

  return (
    <div className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true">
        <span className={`${styles.orb} ${styles.orbA}`} />
        <span className={`${styles.orb} ${styles.orbB}`} />
        <span className={`${styles.orb} ${styles.orbC}`} />
        <span className={styles.grain} />
      </div>

      <Header />

      <main>
        <section className={styles.hero}>
          <motion.p
            className={styles.brand}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0.04}
          >
            MyWallet
          </motion.p>

          <motion.h1
            className={styles.headline}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0.14}
          >
            Money, finally
            <span> under control.</span>
          </motion.h1>

          <motion.p
            className={styles.lead}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0.26}
          >
            Track expenses, income, and forecasts in one calm place. Built for
            real life on your phone.
          </motion.p>

          <motion.div
            className={styles.ctaBlock}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0.38}
          >
            <div className={styles.ctaRow}>
              <Link to="/signup" className={styles.ctaPrimary}>
                <span>Try it free</span>
              </Link>
              <Link to="/signin" className={styles.ctaGhost}>
                <span>Sign in</span>
              </Link>
            </div>
            <p className={styles.ctaHint}>
              Free to start. {TRIAL_DAYS}-day Pro trial when you are ready.
            </p>
          </motion.div>

          <motion.div
            className={styles.heroVisual}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0.5}
            aria-hidden="true"
          >
            <div className={styles.previewShell}>
              <div className={styles.previewGlow} />
              <div className={styles.previewTop}>
                <span>This month</span>
                <strong>+$1,063</strong>
              </div>
              <div className={styles.previewBars}>
                {previewBars.map((bar, index) => (
                  <motion.i
                    key={index}
                    className={bar.active ? styles.previewBarActive : undefined}
                    initial={reduceMotion ? false : { scaleY: 0.15, opacity: 0.35 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{
                      delay: reduceMotion ? 0 : bar.delay,
                      duration: 0.9,
                      ease,
                    }}
                    style={{ height: bar.height, transformOrigin: "bottom" }}
                  />
                ))}
              </div>
              <div className={styles.previewMeta}>
                <span>Spendings</span>
                <span>$2,496</span>
              </div>
            </div>
          </motion.div>
        </section>

        <section className={styles.featureSection} id="about">
          <motion.div
            className={styles.featureCopy}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease }}
          >
            <p className={styles.eyebrow}>Everyday clarity</p>
            <h2>See where your money goes, without the spreadsheet stress.</h2>
            <p>
              Quick capture, categories, income tracking, and a forecast that
              helps you plan ahead. Designed to feel fast on mobile.
            </p>
          </motion.div>

          <div className={styles.featureGrid}>
            {[
              {
                title: "Capture in seconds",
                text: "Add expenses with a fluid form built for thumbs, not desktops.",
              },
              {
                title: "Know your month",
                text: "Spendings, received income, and what’s left, at a glance.",
              },
              {
                title: "Plan forward",
                text: "Project savings and adjust months before surprises hit.",
              },
            ].map((item, index) => (
              <motion.article
                key={item.title}
                className={styles.featureItem}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{
                  delay: index * 0.08,
                  duration: 0.6,
                  ease,
                }}
              >
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className={styles.closeSection}>
          <motion.div
            className={styles.closeInner}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ duration: 0.7, ease }}
          >
            <h2>Ready when you are.</h2>
            <p>Open the app, add a couple expenses, and feel the calm kick in.</p>
            <Link to="/signup" className={styles.ctaPrimary}>
              <span>Create free account</span>
            </Link>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

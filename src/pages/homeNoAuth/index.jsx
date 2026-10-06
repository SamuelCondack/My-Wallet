import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { TRIAL_DAYS } from "../../constants/subscription";
import { useT } from "../../i18n/useT";
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
  const t = useT();
  const reduceMotion = useReducedMotion();
  const featureItems = [
    {
      title: t("landing.features.capture.title"),
      text: t("landing.features.capture.text"),
    },
    {
      title: t("landing.features.month.title"),
      text: t("landing.features.month.text"),
    },
    {
      title: t("landing.features.plan.title"),
      text: t("landing.features.plan.text"),
    },
  ];

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
            {t("landing.hero.headlineLead")}
            <span> {t("landing.hero.headlineAccent")}</span>
          </motion.h1>

          <motion.p
            className={styles.lead}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0.26}
          >
            {t("landing.hero.lead")}
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
                <span>{t("landing.hero.tryFree")}</span>
              </Link>
              <Link to="/signin" className={styles.ctaGhost}>
                <span>{t("landing.hero.signIn")}</span>
              </Link>
            </div>
            <p className={styles.ctaHint}>
              {t("landing.hero.hint", { days: TRIAL_DAYS })}
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
                <span>{t("landing.preview.thisMonth")}</span>
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
                <span>{t("landing.preview.spendings")}</span>
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
            <p className={styles.eyebrow}>{t("landing.about.eyebrow")}</p>
            <h2>{t("landing.about.title")}</h2>
            <p>{t("landing.about.text")}</p>
          </motion.div>

          <div className={styles.featureGrid}>
            {featureItems.map((item, index) => (
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
            <h2>{t("landing.close.title")}</h2>
            <p>{t("landing.close.text")}</p>
            <Link to="/signup" className={styles.ctaPrimary}>
              <span>{t("landing.close.cta")}</span>
            </Link>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

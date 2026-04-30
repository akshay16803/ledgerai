@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.spentyai.app.features.onboarding

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/**
 * Six-slide first-run carousel. Mirrors iOS's `OnboardingSliderView` /
 * `OnboardingSlideCardView` (Direction 1 — real screenshots inside an
 * iPhone-style frame with a per-slide gradient + accent halo).
 *
 * Behaviour:
 *  - Swipe (HorizontalPager) or tap "Next" to advance.
 *  - "Skip" jumps straight to completion.
 *  - Last slide CTA "Get Started" → routes to Login via [onComplete].
 */
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit
) {
    val slides = OnboardingSlide.all
    val pagerState = rememberPagerState(pageCount = { slides.size })
    val scope = rememberCoroutineScope()
    val systemBarsPadding: PaddingValues =
        WindowInsets.systemBars.asPaddingValues()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // ── Paged slides ──
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            OnboardingSlideCard(slide = slides[page])
        }

        // ── Top: segmented progress + skip ──
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = systemBarsPadding.calculateTopPadding())
                .padding(horizontal = 18.dp, vertical = 4.dp)
        ) {
            SegmentedProgress(
                count = slides.size,
                currentIndex = pagerState.currentPage
            )

            if (pagerState.currentPage < slides.size - 1) {
                Spacer(Modifier.height(12.dp))
                Row(modifier = Modifier.fillMaxWidth()) {
                    Spacer(Modifier.weight(1f))
                    SkipPill(onClick = onComplete)
                }
            }
        }

        // ── Bottom: dot indicators + bottom CTA ──
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(bottom = systemBarsPadding.calculateBottomPadding() + 36.dp)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            DotIndicators(
                count = slides.size,
                currentIndex = pagerState.currentPage
            )

            BottomButton(
                isCta = pagerState.currentPage == slides.size - 1,
                onNext = {
                    scope.launch {
                        pagerState.animateScrollToPage(pagerState.currentPage + 1)
                    }
                },
                onComplete = onComplete
            )
        }
    }
}

// ─────────────────────────── Top progress / skip ───────────────────────────

@Composable
private fun SegmentedProgress(count: Int, currentIndex: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        for (i in 0 until count) {
            val active = i <= currentIndex
            val alpha by animateFloatAsState(
                targetValue = if (active) 0.92f else 0.20f,
                label = "progress_$i"
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(3.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = alpha))
            )
        }
    }
}

@Composable
private fun SkipPill(onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        modifier = Modifier
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.14f))
            .border(1.dp, Color.White.copy(alpha = 0.22f), CircleShape)
    ) {
        Text(
            text = "Skip",
            color = Color.White.copy(alpha = 0.88f),
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

// ─────────────────────────── Dot indicators / CTA ──────────────────────────

@Composable
private fun DotIndicators(count: Int, currentIndex: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        for (i in 0 until count) {
            if (i == currentIndex) {
                Box(
                    modifier = Modifier
                        .width(22.dp)
                        .height(7.dp)
                        .clip(CircleShape)
                        .background(Color.White)
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.28f))
                )
            }
        }
    }
}

@Composable
private fun BottomButton(
    isCta: Boolean,
    onNext: () -> Unit,
    onComplete: () -> Unit,
) {
    val gold = Color(0xFFD4AF37)
    val goldLight = Color(0xFFF5D020)
    val ctaTextColor = Color(0xFF1A1400)
    val gradient = Brush.horizontalGradient(listOf(goldLight, gold))

    if (isCta) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(gradient)
                .clickable(onClick = onComplete),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Get Started",
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = ctaTextColor,
            )
        }
    } else {
        Button(
            onClick = onNext,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .border(1.dp, Color.White.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White.copy(alpha = 0.18f),
                contentColor = Color.White,
            ),
        ) {
            Text(
                text = "Next",
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
            )
        }
    }
}

// ─────────────────────────── Slide card ───────────────────────────

@Composable
private fun OnboardingSlideCard(slide: OnboardingSlide) {
    if (slide.isCtaSlide) {
        CtaSlide(slide)
    } else {
        RegularSlide(slide)
    }
}

@Composable
private fun RegularSlide(slide: OnboardingSlide) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = slide.gradientColors,
                    start = androidx.compose.ui.geometry.Offset.Zero,
                    end = androidx.compose.ui.geometry.Offset.Infinite,
                )
            )
    ) {
        // Phone frame proportions match real iPhone (≈ 1 : 2.04). Limit phone
        // height so title + description fit cleanly above bottom controls.
        val phoneAspect = 2.04f
        val availH: Dp = maxHeight * 0.42f
        val candidate = (maxWidth * 0.66f).coerceAtMost(availH / phoneAspect)
        val phoneW: Dp = candidate
        val phoneH: Dp = phoneW * phoneAspect

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(70.dp))

            PhoneFrame(
                slide = slide,
                width = phoneW,
                height = phoneH,
            )

            Spacer(Modifier.height(22.dp))

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (slide.categoryLabel.isNotEmpty()) {
                    CategoryPill(slide)
                }

                Text(
                    text = slide.titleEn,
                    color = Color.White,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 32.sp,
                )

                Text(
                    text = slide.descriptionEn,
                    color = Color.White.copy(alpha = 0.74f),
                    fontSize = 14.5.sp,
                    lineHeight = 21.sp,
                )

                if (slide.statPills.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        slide.statPills.forEach { StatPill(text = it) }
                    }
                }
            }

            Spacer(Modifier.weight(1f))
            // Reserve space for bottom controls
            Spacer(Modifier.height(140.dp))
        }
    }
}

@Composable
private fun PhoneFrame(slide: OnboardingSlide, width: Dp, height: Dp) {
    // Calibrated proportional radii (referenced at width = 280dp in iOS)
    val outerCR = width * 0.128f
    val innerCR = width * 0.102f
    val screenCR = width * 0.080f
    val bezel = width * 0.018f
    val diW = width * 0.245f
    val diH = width * 0.046f
    val diPad = width * 0.050f
    val hiW = width * 0.176f
    val hiBot = width * 0.025f

    Box(
        modifier = Modifier
            .width(width)
            .height(height)
            .shadow(
                elevation = 22.dp,
                shape = RoundedCornerShape(outerCR),
                ambientColor = slide.accentColor.copy(alpha = 0.35f),
                spotColor = slide.accentColor.copy(alpha = 0.35f),
            ),
        contentAlignment = Alignment.TopCenter,
    ) {
        // 1. Outer Space-Black titanium shell
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(outerCR))
                .background(
                    Brush.linearGradient(
                        listOf(
                            Color(0xFF6B6B6B), // 0.42 white
                            Color(0xFF3D3D3D), // 0.24
                            Color(0xFF2E2E2E), // 0.18
                            Color(0xFF4D4D4D), // 0.30
                            Color(0xFF262626), // 0.15
                        )
                    )
                )
        )
        // 2. Faint accent tint
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(outerCR))
                .background(slide.accentColor.copy(alpha = 0.07f))
        )
        // 3. Inner black bezel
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(bezel)
                .clip(RoundedCornerShape(innerCR))
                .background(Color.Black)
        )
        // 4. Real app screenshot
        if (slide.imageRes != null) {
            Image(
                painter = painterResource(id = slide.imageRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bezel + 0.5.dp)
                    .clip(RoundedCornerShape(screenCR))
            )
        }
        // 5. Dynamic Island
        Box(
            modifier = Modifier
                .padding(top = diPad)
                .width(diW)
                .height(diH)
                .clip(CircleShape)
                .background(Color.Black)
        )
        // 6. Home indicator (bottom)
        Box(
            modifier = Modifier
                .fillMaxSize(),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Box(
                modifier = Modifier
                    .padding(bottom = hiBot)
                    .width(hiW)
                    .height(3.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.55f))
            )
        }
    }
}

@Composable
private fun CategoryPill(slide: OnboardingSlide) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
            .clip(CircleShape)
            .background(slide.accentColor.copy(alpha = 0.16f))
            .border(1.dp, slide.accentColor.copy(alpha = 0.35f), CircleShape)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(
            text = slide.categoryLabel,
            color = slide.accentColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
        )
    }
}

@Composable
private fun StatPill(text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.10f))
            .border(1.dp, Color.White.copy(alpha = 0.20f), CircleShape)
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Text(
            text = "✓",
            color = Color.White.copy(alpha = 0.92f),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = text,
            color = Color.White.copy(alpha = 0.92f),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

// ─────────────────────────── CTA slide ───────────────────────────

@Composable
private fun CtaSlide(slide: OnboardingSlide) {
    val gold = Color(0xFFD4AF37)
    val goldLight = Color(0xFFF5D020)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = slide.gradientColors,
                    start = androidx.compose.ui.geometry.Offset.Zero,
                    end = androidx.compose.ui.geometry.Offset.Infinite,
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(92.dp))

            // Crown badge stack
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(188.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(188.dp)
                        .clip(CircleShape)
                        .background(gold.copy(alpha = 0.22f))
                        .blur(32.dp)
                )
                Box(
                    modifier = Modifier
                        .size(148.dp)
                        .clip(CircleShape)
                        .border(1.dp, gold.copy(alpha = 0.45f), CircleShape)
                )
                Box(
                    modifier = Modifier
                        .size(122.dp)
                        .shadow(
                            elevation = 16.dp,
                            shape = CircleShape,
                            ambientColor = gold.copy(alpha = 0.6f),
                            spotColor = gold.copy(alpha = 0.6f),
                        )
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(listOf(goldLight, gold))
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "♛",
                        color = Color.White,
                        fontSize = 50.sp,
                    )
                }
            }

            Spacer(Modifier.height(30.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .clip(CircleShape)
                    .background(gold.copy(alpha = 0.16f))
                    .border(1.dp, gold.copy(alpha = 0.45f), CircleShape)
                    .padding(horizontal = 14.dp, vertical = 7.dp)
            ) {
                Text(
                    text = "✦",
                    color = gold,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "7 DAYS FREE",
                    color = gold,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.6.sp,
                )
            }

            Spacer(Modifier.height(16.dp))

            Text(
                text = slide.titleEn,
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(10.dp))

            Text(
                text = slide.descriptionEn,
                color = Color.White.copy(alpha = 0.74f),
                fontSize = 14.5.sp,
                lineHeight = 22.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(22.dp))

            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                CtaFeatureRow("Every feature fully unlocked")
                CtaFeatureRow("Zero limits — every account & history")
                CtaFeatureRow("Charged only after day 7 — cancel any time")
            }

            Spacer(Modifier.weight(1f))
            Spacer(Modifier.height(150.dp))
        }
    }
}

@Composable
private fun CtaFeatureRow(text: String) {
    val gold = Color(0xFFD4AF37)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(gold.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "✓",
                color = gold,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Text(
            text = text,
            color = Color.White.copy(alpha = 0.88f),
            fontSize = 14.sp,
        )
    }
}

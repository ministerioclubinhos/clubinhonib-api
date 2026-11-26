import { Injectable } from '@nestjs/common';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';

/** Flag `clubinho_play`; se a flag não existir no banco, vale como ligada. */
@Injectable()
export class PlayAccessService {
  constructor(private readonly flags: GetFeatureFlagsService) {}

  /** O envio exige o Play e a flag própria `play_submissions`. */
  async assertSubmissionsEnabled(): Promise<void> {
    await this.assertEnabled();
    if (
      !(await this.flags.isSwitchedOn(FeatureFlagKeys.PLAY_SUBMISSIONS, true))
    ) {
      throw new AppForbiddenException(
        ErrorCode.FEATURE_DISABLED,
        'O envio de vídeos ao Clubinho Play está desativado.',
      );
    }
  }

  async assertEnabled(): Promise<void> {
    if (!(await this.flags.isSwitchedOn(FeatureFlagKeys.CLUBINHO_PLAY, true))) {
      throw new AppForbiddenException(
        ErrorCode.FEATURE_DISABLED,
        'O Clubinho Play está desativado.',
      );
    }
  }
}

#!/bin/bash
# Test script to verify cat rotation works for all 3 days

set -e

ORIGINAL_CONTENT=$(cat README.md)

echo "Testing cat rotation for 3 consecutive days..."
echo "=============================================="
echo

for DAY_OFFSET in 0 1 2; do
    # Restore original content
    echo "$ORIGINAL_CONTENT" > README.md
    
    # Simulate day of year
    TEST_DAY=$(( ($(date +%j) + DAY_OFFSET) % 366 ))
    if [ $TEST_DAY -eq 0 ]; then TEST_DAY=366; fi
    
    CAT_INDEX=$(($TEST_DAY % 3 + 1))
    
    echo "Day $((DAY_OFFSET + 1)): Day of year = $TEST_DAY → cat${CAT_INDEX}.gif"
    
    # Apply rotation
    sed -i "s|images/cat[1-3]\.gif|images/cat${CAT_INDEX}.gif|g" README.md
    
    # Verify the change
    CURRENT_CAT=$(grep -o 'images/cat[1-3]\.gif' README.md)
    echo "  README.md now contains: $CURRENT_CAT"
    
    if [ "$CURRENT_CAT" != "images/cat${CAT_INDEX}.gif" ]; then
        echo "  ❌ ERROR: Expected cat${CAT_INDEX}.gif but got $CURRENT_CAT"
        exit 1
    fi
    
    # Test idempotency - running again should not change anything
    sed -i "s|images/cat[1-3]\.gif|images/cat${CAT_INDEX}.gif|g" README.md
    AFTER_SECOND=$(grep -o 'images/cat[1-3]\.gif' README.md)
    
    if [ "$AFTER_SECOND" != "$CURRENT_CAT" ]; then
        echo "  ❌ ERROR: Not idempotent! Changed from $CURRENT_CAT to $AFTER_SECOND"
        exit 1
    fi
    
    echo "  ✅ Idempotent: Running twice produces same result"
    echo
done

# Restore original
echo "$ORIGINAL_CONTENT" > README.md

echo "=============================================="
echo "✅ All tests passed!"
echo "   - All 3 cats rotate correctly"
echo "   - Script is idempotent"

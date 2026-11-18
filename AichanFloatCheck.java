import java.util.Arrays;

public class AichanFloatCheck {
    public static void main(String[] args) {
        for (String arg : args) {
            int seed = Integer.parseInt(arg);
            int x = seed;
            int y = seed;
            int z = seed;
            int[] order = new int[5000];
            for (int i = 0; i < order.length; i++) {
                order[i] = i;
            }
            for (int i = order.length - 1; i > 0; i--) {
                x = 171 * x % 30269;
                y = 172 * y % 30307;
                z = 170 * z % 30323;
                float random = ((x / 30269f + y / 30307f) + z / 30323f) % 1f;
                int j = (int) (random * i);
                int previous = order[i];
                order[i] = order[j];
                order[j] = previous;
            }
            System.out.println(Arrays.toString(order));
        }
    }
}
